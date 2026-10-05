import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Header from './AuthHeader';
import Footer from './Footer';

// MUI
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';

const SITE_KEY = "6LdW44wrAAAAAEc41rGTJQrnC-95Qt_mqMkz2Tx8";

function LoginForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCaptcha = (value) => {
    setCaptchaVerified(!!value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { username, password } = form;

    if (!username || !password) {
      toast.error('All fields are required');
      return;
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/;

    if (!passwordRegex.test(password)) {
      toast.error(
        'Password must be at least 8 characters long, include one uppercase letter, one number, and one special character'
      );
      return;
    }

    if (!captchaVerified) {
      toast.error('Please verify that you are not a robot');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.status === 423) {
        // Account locked
        const mins = Math.ceil((data.retryAfterSeconds || 900) / 60);
        toast.error(`Account locked. Too many failed attempts. Try again in ${mins} minute(s).`, { autoClose: 6000 });
        return;
      }

      if (response.ok && data.user && data.user.username) {
        localStorage.setItem("loggedInUsername", data.user.username);
        localStorage.setItem("loggedInUser", JSON.stringify(data.user));

        toast.success('Login successful!');

        setTimeout(() => {
          const { role, module } = data.user;

          if (module === 'mosquito') {
            if (role === 'mos_admin') navigate('/mosquito-admin-dashboard');
            else if (role === 'district_user') navigate('/mosquito-district-dashboard');
            else if (role === 'block_user') navigate('/block-dashboard');
            else if (role === 'corporation_user') navigate('/corp_dashboard');
            else if (role === 'municipality_user') navigate('/mun_dashboard');
            else toast.error('Unauthorized mosquito role');
          } else if (module === 'chlorination') {
            if (role === 'chl_admin') navigate('/chl-admin-dashboard');
            else if (role === 'hub_officer') navigate('/hub-dashboard');
            else if (role === 'DHO') navigate('/hud-admin-dashboard');
            else if (role === 'block_user') navigate('/hud-block-dashboard');
            else if (role === 'RWAL_hi_user') navigate('/hud-block-dashboard');
            else if (role === 'hi_user') navigate('/hud-block-dashboard');
            else toast.error('Unauthorized chlorination role');
          } else if (module === 'hud') {
            if (role === 'hud_admin') navigate('/hud-admin-dashboard');
            else if (role === 'DHO') navigate('/hud-user-dashboard');
            else toast.error('Unauthorized HUD role');
          } else if (module === 'developer' && role === 'DEVELOPER') {
            navigate('/developer/dashboard');
          } else {
            toast.error('Unknown module');
          }
        }, 1500);
      } else {
        const attemptsLeft = data.attemptsRemaining;
        const msg = attemptsLeft != null
          ? `${data.message} (${attemptsLeft} attempt(s) remaining before lockout)`
          : data.message || 'Login failed';
        toast.error(msg);
      }
    } catch (error) {
      console.error(error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes zoomSlow {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
      `}</style>

      {/* Background Layer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: '100%',
          backgroundImage: "url('/loginbg1.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          animation: 'zoomSlow 30s ease-in-out infinite alternate',
          zIndex: -2,
        }}
      />

      {/* Overlay Layer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          zIndex: -1,
        }}
      />

      {/* Main Content */}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header />

        <main
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <div
            className="card p-4 shadow-lg w-100"
            style={{
              maxWidth: '400px',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255,255,255,0.9)',
              fontFamily: 'Nunito Sans',
              borderRadius: '16px',
              zIndex: 2,
            }}
          >
            <h4 className="mb-4 text-center fw-semibold">Login</h4>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <TextField
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  placeholder="Enter username"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Password</label>
                <TextField
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  placeholder="Enter password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={togglePasswordVisibility}
                          edge="end"
                          aria-label="toggle password visibility"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </div>

              <div className="mb-3 d-flex justify-content-center">
                <ReCAPTCHA sitekey={SITE_KEY} onChange={handleCaptcha} />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
                disabled={loading}
                style={{ height: '40px' }}
              >
                {loading ? (
                  <CircularProgress size={24} style={{ color: 'white' }} />
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </main>

        <Footer />
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="colored"
        limit={2}
        pauseOnHover
        draggable
        hideProgressBar={false}
      />
    </>
  );
}

export default LoginForm;
