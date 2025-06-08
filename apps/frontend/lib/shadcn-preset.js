/** @type {import('tailwindcss').Config} */
module.exports = {
    theme: {
      extend: {
        borderRadius: {
          lg: "var(--radius)",
        },
        colors: {
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          border: "hsl(var(--border))",
          ring: "hsl(var(--ring))",
        },
        fontFamily: {
          sans: ["Inter", "sans-serif"],
        },
      },
    },
  };
  