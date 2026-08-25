import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, handleAuthError } from '@/lib/auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    const dbUser = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = dbUser.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    // 1. Fetch installation details
    const instRes = await pool.query(
      'SELECT installation_id, org_login FROM installations WHERE company_id = $1 AND is_deleted = false',
      [companyId]
    );

    if (instRes.rows.length === 0) {
      return NextResponse.json({ repos: [] }, { status: 200 });
    }

    const { installation_id: installationId, org_login: orgLogin } = instRes.rows[0];

    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;

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

    const isMockMode = !appId || !rawPrivateKey || appId === '123456';

    if (isMockMode) {
      // Mock templates for development convenience
      const mockRepos = [
        { name: 'python-sandbox-template', fullName: `${orgLogin}/python-sandbox-template`, htmlUrl: `https://github.com/${orgLogin}/python-sandbox-template` },
        { name: 'javascript-hiring-boilerplate', fullName: `${orgLogin}/javascript-hiring-boilerplate`, htmlUrl: `https://github.com/${orgLogin}/javascript-hiring-boilerplate` },
        { name: 'cpp-algorithm-challenge', fullName: `${orgLogin}/cpp-algorithm-challenge`, htmlUrl: `https://github.com/${orgLogin}/cpp-algorithm-challenge` }
      ];
      return NextResponse.json({ repos: mockRepos }, { status: 200 });
    }

    // Live GitHub API call to fetch repositories granted to this installation
    try {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      const app = new App({
        appId,
        privateKey
      });

      const octokit = await app.getInstallationOctokit(parseInt(installationId, 10));
      const response = await octokit.request('GET /installation/repositories');
      
      const repos = (response.data.repositories || []).map(r => ({
        name: r.name,
        fullName: r.full_name,
        htmlUrl: r.html_url
      }));

      return NextResponse.json({ repos }, { status: 200 });
    } catch (gitErr) {
      console.error('Failed to fetch installation repositories from GitHub:', gitErr);
      return NextResponse.json({ error: `GitHub API Error: ${gitErr.message || 'Failed to list repositories'}` }, { status: 500 });
    }
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;
    
    console.error('github-repos API Exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
