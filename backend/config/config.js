require('dotenv').config();

const config = {
  development: {
    apiUrl: 'http://localhost:5000',
    frontendUrl: 'http://localhost:3000',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    },
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d'
    }
  },
  production: {
    apiUrl: process.env.API_URL || 'https://your-backend-url.onrender.com',
    frontendUrl: process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app',
    database: {
      host: 'dpg-d0iad8p5pdvs73fodo70-a',
      port: 5432,
      database: 'localhubdb',
      user: 'localhub',
      password: 'pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg',
      ssl: {
        rejectUnauthorized: false
      }
    },
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d'
    }
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env]; 