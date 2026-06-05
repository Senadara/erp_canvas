import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans],
                display: ['Outfit', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                brand: {
                    50: '#f4f6fc',
                    100: '#e7ecf7',
                    200: '#cbd7ed',
                    300: '#9fb9df',
                    400: '#6d92ce',
                    500: '#4871be',
                    600: '#35569c',
                    700: '#2b447d',
                    800: '#263b6a',
                    900: '#233358',
                    950: '#17203b',
                },
                accent: {
                    50: '#fdf3f4',
                    100: '#fbe4e7',
                    200: '#f7ced4',
                    300: '#f0acb7',
                    400: '#e57a8e',
                    500: '#d54d67',
                    600: '#bd334d',
                    700: '#9f263d',
                    800: '#852236',
                    900: '#712131',
                    950: '#3f0d18',
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },

    plugins: [forms],
};
