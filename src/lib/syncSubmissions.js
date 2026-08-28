import pool from './db';
import { logAudit } from './auth';

export async function syncSubmissions() {
  try {
    // Query active submissions that are PENDING or PROCESSING
    const pendingSubs = await pool.query(
      `SELECT id, evaluation_id, status FROM submissions 
       WHERE status IN ('PENDING', 'PROCESSING') AND is_deleted = false AND evaluation_id IS NOT NULL`
    );

    if (pendingSubs.rows.length === 0) {
      return { syncedCount: 0 };
    }

    const analyzerBase = (process.env.ANALYZER_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
    let syncedCount = 0;

    for (const sub of pendingSubs.rows) {
      const { id: submissionId, evaluation_id: evaluationId } = sub;
      const getUrl = `${analyzerBase}/api/v1/evaluations/${evaluationId}`;

      try {
        const response = await fetch(getUrl);
        if (!response.ok) {
          console.error(`Failed to poll status for evaluation ${evaluationId}: status ${response.status}`);
          continue;
        }

        const data = await response.json();
        const newStatus = data.status; // 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'

        if (newStatus === 'COMPLETED' || newStatus === 'SUCCESS') {
          const score = data.final_score !== undefined ? data.final_score : (data.verdict?.final_score !== undefined ? data.verdict.final_score : null);
          const band = data.band || data.verdict?.band || null;
          const confidence = data.confidence !== undefined ? data.confidence : (data.verdict?.confidence !== undefined ? data.verdict.confidence : null);
          const reasons = data.reasons || data.verdict?.reasons || [];
          const attributes = data.attributes || data.verdict?.attributes || {};

          await pool.query(
            `UPDATE submissions 
             SET status = 'Graded', final_score = $1, band = $2, confidence = $3, reasons = $4, attributes = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [score, band, confidence, JSON.stringify(reasons), JSON.stringify(attributes), submissionId]
          );

          // Get competition metadata for audit trail
          const subInfo = await pool.query('SELECT competition_id FROM submissions WHERE id = $1', [submissionId]);
          const compId = subInfo.rows[0]?.competition_id;

          await logAudit({
            action: 'SUBMISSION_EVALUATED',
            performedBy: null,
            targetType: 'Competition',
            targetId: compId,
            details: `Submission ID ${submissionId} evaluation completed successfully. Score: ${score}%, Band: ${band}.`
          });

          syncedCount++;
        } else if (newStatus === 'FAILED') {
          const errorMsg = data.error || 'Evaluation failed on analyzer service';
          await pool.query(
            `UPDATE submissions 
             SET status = 'FAILED', error_message = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [errorMsg, submissionId]
          );

          const subInfo = await pool.query('SELECT competition_id FROM submissions WHERE id = $1', [submissionId]);
          const compId = subInfo.rows[0]?.competition_id;

          await logAudit({
            action: 'SUBMISSION_FAILED',
            performedBy: null,
            targetType: 'Competition',
            targetId: compId,
            details: `Submission ID ${submissionId} evaluation failed. Error: ${errorMsg}`
          });

          syncedCount++;
        } else if (newStatus && newStatus !== sub.status) {
          await pool.query(
            "UPDATE submissions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [newStatus, submissionId]
          );
        }
      } catch (err) {
        console.error(`Network or db error polling submission ${submissionId}:`, err);
      }
    }

    return { syncedCount };
  } catch (err) {
    console.error('syncSubmissions error:', err);
    throw err;
  }
}
