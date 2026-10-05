// import sendOTPEmail from '../utils/sendMail.js';
import pool from '../utils/db.js';


const users = [
        { username: 'karthi@example.com', password: 'nodejs123' }
];

// Generate 6-digit numeric OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Step 1: Forgot Password - Generate OTP
const handleForgotPassword = async (req, res) => {
    const { username } = req.body;
    var otp = '';
    const user = users.find(u => u.username === username);
    if (user) {
        otp = generateOTP();
        req.session.otpData = {
            otp,
            username,
            createdAt: Date.now()
        };
    }
    else{
        try {
            const result = await pool.query(
            'SELECT * FROM district_officer_table WHERE username = $1',
            [username]
            );

            if (result.rows.length > 0) {
                otp = generateOTP();
                req.session.otpData = {
                    otp,
                    username,
                    createdAt: Date.now()
                };
            } 
            else {
                return res.status(404).json({ message: 'User not found.' });
            }
        } 
        catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    }

    try {
        await sendOTPEmail('karthikeyan.ravi1127@gmail.com', otp); // send to userId (email)
        res.status(200).json({ message: 'OTP sent to your email.' });
    } 
    catch (err) {
        console.error('Failed to send OTP email:', err);
        res.status(500).json({ message: 'Failed to send OTP email.' });
    }
};

// Step 2: Verify OTP
const verifyOTP = (req, res) => {
    const { username, otp } = req.body;

    const otpData = req.session.otpData;

    if (!otpData) {
        return res.status(400).json({ message: 'OTP not found. Please request a new OTP.' });
    }
    if (otpData.username !== username) {
        return res.status(400).json({ message: 'Username does not match the OTP.' });
    }
    
    const isExpired = (Date.now() - otpData.createdAt) > 2 * 60 * 1000; // 2 min
    if (isExpired) {
        delete req.session.otpData;
        return res.status(410).json({ message: 'OTP has expired.' });
    }

    if(otpData.otp === otp || otpData.username === username){
        console.log('OTP verified successfully:', otpData.otp);
        // Optionally clear OTP from session
        delete req.session.otpData;
        res.status(200).json({ message: 'OTP verified successfully!' });
    }
    else{
        console.error('OTP verification failed:', otpData.otp);
        delete req.session.otpData;
        res.status(401).json({ message: 'OTP verification failed' });
    }
};

const resetPassword = async (req, res) => {
    const { username, newPassword } = req.body;
    const user = users.find(u => u.username === username);
    if (user) {
        user.password = newPassword;
        try {
            const result = await pool.query(
                'UPDATE admin_table SET password = $1 WHERE username = $2',
                [newPassword, username]
            );

            if (result.rowCount > 0) {
                res.status(200).json({ message: 'Password reset successfully.' });
            } else {
                res.status(404).json({ message: 'User not found.' });
            }
        } 
        catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    }
    
    try {
        const result = await pool.query(
            'UPDATE district_officer_table SET password = $1 WHERE username = $2',
            [newPassword, username]
        );

        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Password reset successfully.' });
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}   

export default {
    handleForgotPassword,
    verifyOTP,
    resetPassword
};
// This code handles the forgot password functionality, including generating and verifying OTPs, and resetting the password.