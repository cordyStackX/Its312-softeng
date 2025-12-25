// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/auth/google/callback",
      passReqToCallback: true,
    },
    // use req so we can detect signup flow (req.session.googleSignup)
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const fullname = profile.displayName || "";

        if (!email) return done(new Error("No email returned by Google"), null);

        // Try find by google_id first
        let user = await User.findByGoogleId(googleId);
        if (user) return done(null, user);

        // Then try by email (maybe user signed up via email/password)
        const userByEmail = await User.findByEmail(email);
        const isSignup = (req.session && req.session.googleSignup) || (req.query && req.query.signup === 'true');

        if (userByEmail) {
          // Associate Google ID if not set
          if (!userByEmail.google_id) {
            try { await User.updateGoogleId(email, googleId); } catch (e) { /* ignore */ }
          }
          return done(null, userByEmail);
        }

        if (isSignup) {
          // create new user for signup flow
          if (req.session && req.session.googleSignup) delete req.session.googleSignup;
          user = await User.createUser({ fullname, email, googleId });
          return done(null, user);
        }

        // Not signup and not found => reject (frontend can prompt to sign up)
        return done(null, false, { message: "Email not registered" });
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
