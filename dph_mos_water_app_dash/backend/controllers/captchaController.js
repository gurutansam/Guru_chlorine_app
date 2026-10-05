import svgCaptcha from 'svg-captcha';

// Temporary store for captcha text (in-memory)
let currentCaptcha = '';

const getCaptcha = (req, res) => {
    const captcha = svgCaptcha.create({
        size: 6,
        noise: 2,
        color: true,
        background: '#ccf2ff'
    });

    currentCaptcha = captcha.text; // Save it for validation

    res.type('svg');
    res.status(200).send(captcha.data); // Send SVG image data to frontend
};

const validateCaptcha = (inputCaptcha) => {
    return inputCaptcha && inputCaptcha === currentCaptcha;
};

export default { getCaptcha, validateCaptcha };
