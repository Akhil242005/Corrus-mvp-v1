import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit, handleAuthError } from '@/lib/auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    const user = await requireRole(req, ['company_admin']);
    const companyId = user.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const installationId = searchParams.get('installation_id');
    const manualOrgLogin = searchParams.get('org_login');

    if (!installationId) {
      return NextResponse.json({ error: 'installation_id is required' }, { status: 400 });
    }

    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;

    // Fallback: Check if GITHUB_PRIVATE_KEY_PATH file exists and read it
    if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {
        console.error('Failed to read private key file:', err);
      }
    }

    let orgLogin = manualOrgLogin || '';
    if (!orgLogin) {
      if (!appId || !rawPrivateKey || appId === '123456') {
        // Local-dev mock-mode fallback
        orgLogin = `mock-org-${installationId}`;
        console.log(`[GITHUB APP MOCK] App keys missing or placeholder App ID. Creating mock installation: ${orgLogin}`);
      } else {
        // Normalize private key in case it has literal \n characters from .env
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

        try {
          const app = new App({
            appId,
            privateKey
          });

          // Fetch the organization details authenticated as the GitHub App
          const response = await app.octokit.request('GET /app/installations/{installation_id}', {
            installation_id: parseInt(installationId, 10)
          });
          orgLogin = response.data.account.login;
        } catch (gitErr) {
          console.error('Failed to retrieve installation details from GitHub API:', gitErr);
          return NextResponse.json(
            { error: `GitHub API Error: ${gitErr.message || 'Failed to authenticate installation_id'}` },
            { status: 400 }
          );
        }
      }
    }

    if (!orgLogin) {
      return NextResponse.json({ error: 'Could not resolve organization login from GitHub' }, { status: 400 });
    }

    // Upsert installation details
    await pool.query(
      `INSERT INTO installations (company_id, org_login, installation_id, is_deleted, deleted_at)
       VALUES ($1, $2, $3, false, null)
       ON CONFLICT (installation_id)
       DO UPDATE SET company_id = $1, org_login = $2, is_deleted = false, deleted_at = null, installed_at = CURRENT_TIMESTAMP`,
      [companyId, orgLogin, parseInt(installationId, 10)]
    );

    // Log connected audit event
    await logAudit({
      action: 'INSTALLATION_CONNECTED',
      performedBy: user.id,
      targetType: 'Company',
      targetId: companyId,
      details: `GitHub App installation connected for organization "${orgLogin}" (Installation ID: ${installationId})`
    });

    return NextResponse.json({ success: true, orgLogin }, { status: 200 });
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;

    console.error('GitHub setup callback endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error linking installation' }, { status: 500 });
  }
}
