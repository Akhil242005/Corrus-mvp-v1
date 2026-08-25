import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { logAudit } from '@/lib/auth';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/?error=OAuth+code+missing', req.url));
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      console.error('GitHub token exchange error:', tokenData);
      return NextResponse.redirect(new URL('/?error=Token+exchange+failed', req.url));
    }

    const { access_token } = tokenData;

    // Fetch user details from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` },
    });
    const githubProfile = await userResponse.json();

    if (!githubProfile || !githubProfile.id) {
      return NextResponse.redirect(new URL('/?error=Failed+to+fetch+user+profile', req.url));
    }

    // Fetch user email from GitHub (emails can be private)
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `token ${access_token}` },
    });
    const emails = await emailsResponse.json();

    let email = githubProfile.email;
    if (!email && Array.isArray(emails) && emails.length > 0) {
      const primaryEmailObj = emails.find(e => e.primary && e.verified) || emails[0];
      email = primaryEmailObj.email;
    }

    if (!email) {
      email = `${githubProfile.login}@github.com`;
    }

    email = email.trim().toLowerCase();
    const nameParts = (githubProfile.name || githubProfile.login).split(' ');
    const firstname = nameParts[0] || githubProfile.login;
    const lastname = nameParts.slice(1).join(' ') || '';
    const githubId = githubProfile.id.toString();

    // Check if user already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE (github_id = $1 OR email = $2) AND is_deleted = false',
      [githubId, email]
    );

    let user;
    if (userCheck.rows.length === 0) {
      // Register new user
      const insertRes = await pool.query(
        `INSERT INTO users (firstname, lastname, email, github_id, github_username, auth_provider) 
         VALUES ($1, $2, $3, $4, $5, 'github') 
         RETURNING id, firstname, email, role`,
        [firstname, lastname, email, githubId, githubProfile.login]
      );
      user = insertRes.rows[0];

      await logAudit({
        action: 'REGISTER_USER',
        performedBy: user.id,
        targetType: 'User',
        targetId: user.id,
        details: `New candidate registered via GitHub: ${user.email} (${githubProfile.login})`
      });
    } else {
      user = userCheck.rows[0];
      // Update GitHub ID, username, and provider if needed
      await pool.query(
        'UPDATE users SET github_id = $1, github_username = $2, auth_provider = \'github\' WHERE id = $3',
        [githubId, githubProfile.login, user.id]
      );
      
      // Update local object fields
      user.github_id = githubId;
      user.github_username = githubProfile.login;
      user.auth_provider = 'github';
    }

    const token = jwt.sign(
      { userId: user.id.toString(), email: user.email, firstname: user.firstname, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await logAudit({
      action: 'LOGIN_USER',
      performedBy: user.id,
      targetType: 'User',
      targetId: user.id,
      details: `Candidate logged in via GitHub: ${user.email}`
    });

    return NextResponse.redirect(new URL(`/oauth-success?token=${token}`, req.url));
  } catch (err) {
    console.error('GitHub callback error:', err);
    return NextResponse.redirect(new URL('/?error=GitHub+OAuth+failed', req.url));
  }
}
