import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    const admin = await requireRole(req, ['admin']);
    const { id: companyIdStr } = await params;
    const companyId = parseInt(companyIdStr, 10);

    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const { isVerified } = await req.json();

    const companyRes = await pool.query('SELECT name, is_verified FROM companies WHERE id = $1', [companyId]);
    if (companyRes.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companyRes.rows[0];
    const oldStatus = company.is_verified;
    const nextStatus = Boolean(isVerified);

    await pool.query(
      'UPDATE companies SET is_verified = $1 WHERE id = $2',
      [nextStatus, companyId]
    );

    await logAudit({
      action: nextStatus ? 'VERIFY_COMPANY' : 'UNVERIFY_COMPANY',
      performedBy: admin.id,
      targetType: 'Company',
      targetId: companyId,
      changes: { isVerified: { old: oldStatus, new: nextStatus } },
      details: `${nextStatus ? 'Verified' : 'Unverified'} company "${company.name}"`
    });

    const updatedRes = await pool.query(
      'SELECT id, name, place, description, website, is_verified as "isVerified" FROM companies WHERE id = $1',
      [companyId]
    );
    const updatedCompany = updatedRes.rows[0];

    const formattedCompany = {
      _id: updatedCompany.id.toString(),
      id: updatedCompany.id,
      name: updatedCompany.name,
      place: updatedCompany.place,
      description: updatedCompany.description || '',
      website: updatedCompany.website || '',
      isVerified: updatedCompany.isVerified
    };

    return NextResponse.json({ message: `Company ${nextStatus ? 'verified' : 'unverified'} successfully`, company: formattedCompany }, { status: 200 });
  } catch (err) {
    console.error('Company Verify API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update company verification status' }, { status: 500 });
  }
}
