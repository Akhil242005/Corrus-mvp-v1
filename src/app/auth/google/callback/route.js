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
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData);
      return NextResponse.redirect(new URL('/?error=Token+exchange+failed', req.url));
    }

    const { access_token } = tokenData;

    // Fetch user details from Google
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`);
    const googleProfile = await userResponse.json();

    if (!googleProfile || !googleProfile.email) {
      return NextResponse.redirect(new URL('/?error=Failed+to+fetch+user+profile', req.url));
    }

    const email = googleProfile.email.trim().toLowerCase();
    const firstname = googleProfile.given_name || googleProfile.name || 'Candidate';
    const lastname = googleProfile.family_name || '';
    const googleId = googleProfile.id;

    // Check if user already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE (google_id = $1 OR email = $2) AND is_deleted = false',
      [googleId, email]
    );

    let user;
    if (userCheck.rows.length === 0) {
      // Register new user
      const insertRes = await pool.query(
        `INSERT INTO users (firstname, lastname, email, google_id, auth_provider) 
         VALUES ($1, $2, $3, $4, 'google') 
         RETURNING id, firstname, email, role`,
        [firstname, lastname, email, googleId]
      );
      user = insertRes.rows[0];

      await logAudit({
        action: 'REGISTER_USER',
        performedBy: user.id,
        targetType: 'User',
        targetId: user.id,
        details: `New candidate registered via Google: ${user.email}`
      });
    } else {
      user = userCheck.rows[0];
      // Update Google ID and provider if needed
      await pool.query(
        'UPDATE users SET google_id = $1, auth_provider = \'google\' WHERE id = $2',
        [googleId, user.id]
      );
      
      // Update local object fields
      user.google_id = googleId;
      user.auth_provider = 'google';
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
      details: `Candidate logged in via Google: ${user.email}`
    });

    return NextResponse.redirect(new URL(`/oauth-success?token=${token}`, req.url));
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/?error=Google+OAuth+failed', req.url));
  }
}
