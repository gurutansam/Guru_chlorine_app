import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import '../Styles/Dashboard/ForgetPassword.css';
import Header from './AuthHeader';

const ForgetPassword = () => {
  const [step, setStep] = useState("mail");
  const [mail, setMail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleEmailSubmit = (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    // TODO: send email to backend
    setStep("otp");
    toast.success("OTP sent to your mail.");
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();

    if (otp === "123456") {
      setStep("reset");
      toast.success("OTP verified! Please set your new password.");
    } else {
      toast.error("Invalid OTP. Please try again.");
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{};':"\\|,.<>\/?]).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      toast.error("Password must be at least 8 characters, include an uppercase letter, a number, and a special character.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    toast.success("Password reset successful!");
    // TODO: Send newPassword to backend
  };

  return (
    <div
      style={{
        backgroundImage: "url('/loginbg1.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <Header />
      <div className="container mt-5" style={{ maxWidth: "400px" }}>
        <h3 className="text-center mb-4">Forgot Password</h3>

        {step === "mail" && (
          <form onSubmit={handleEmailSubmit}>
            <div className="mb-3">
              <label htmlFor="mail" className="form-label">Enter Mail:</label>
              <input
                type="text"
                id="mail"
                className="form-control"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Send OTP
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit}>
            <div className="mb-3">
              <label htmlFor="otp" className="form-label">Enter OTP</label>
              <input
                type="text"
                id="otp"
                className="form-control"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Verify OTP
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-3">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-success w-100">
              Set Password
            </button>
          </form>
        )}
        <ToastContainer
         position="top-right"
         autoClose={3000}
         theme="colored"
         limit={2}
         pauseOnHover
         draggable
         hideProgressBar={false}
       />
      </div>
    </div>
  );
};

export default ForgetPassword;
