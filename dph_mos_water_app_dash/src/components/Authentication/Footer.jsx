import React from "react";
import { Box, Typography, Container,Link  } from "@mui/material";

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: "#ffffffcc", // semi-transparent white
        backdropFilter: "blur(2px)", // glass-like blur effect
        borderTop: "1px solid #ddd",
        py: 2,
        mt: 'auto',
      }}
    >
      <Container maxWidth="md" sx={{ fontFamily: "'Merriweather', serif" }}>
        <Typography
          variant="body2"
          sx={{ fontSize: 14, color: "#555" }}
          align="center"
        >
          © {new Date().getFullYear()} All rights reserved. This content is owned and maintained by{" "}
          <Box component="span" sx={{ color: "#003366", fontWeight: 600 }}>
            Directorate of Public Health and Preventive Medicine
          </Box>.
        </Typography>

        <Typography
            variant="body2"
            align="center"
            sx={{ fontSize: 14, mt: 0.5 }}
            >
            Developed by{" "}
            <Link
                href="https://tansam.org/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "#003366", fontWeight: 600, textDecoration: "none" }}
            >
                TANSAM, Chennai
            </Link>.
            </Typography>
      </Container>
    </Box>
  );
};

export default Footer;