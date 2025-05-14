# LocalHub - Local Business Discovery Platform

A full-stack application for discovering and connecting with local businesses, available on web and Android platforms.

## Project Structure

```
localhub/
├── backend/           # Node.js backend
├── android/          # Android native app
└── web/             # React web frontend
```

## Deployment Instructions

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the following:
   - Build Command: `cd backend && npm install --production`
   - Start Command: `cd backend && npm start`
   - Environment Variables:
     ```
     NODE_ENV=production
     PORT=5000
     DB_HOST=dpg-d0iad8p5pdvs73fodo70-a.singapore-postgres.render.com
     DB_PORT=5432
     DB_NAME=localhubdb
     DB_USER=localhub
     DB_PASSWORD=pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg
     JWT_SECRET=your-jwt-secret
     CLOUDINARY_CLOUD_NAME=your-cloud-name
     CLOUDINARY_API_KEY=your-api-key
     CLOUDINARY_API_SECRET=your-api-secret
     ```
4. Advanced Settings:
   - Node Version: 18.x (LTS)
   - Auto-Deploy: Enabled
   - Health Check Path: /api/health

### Database (Render)

The database is already set up on Render with the following details:
- Host: dpg-d0iad8p5pdvs73fodo70-a.singapore-postgres.render.com
- Port: 5432
- Database: localhubdb
- Username: localhub
- Password: pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg

Connection URLs:
- Internal: postgresql://localhub:pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg@dpg-d0iad8p5pdvs73fodo70-a/localhubdb
- External: postgresql://localhub:pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg@dpg-d0iad8p5pdvs73fodo70-a.singapore-postgres.render.com/localhubdb

### Web Frontend (Vercel)

1. Create a new project on Vercel
2. Connect your GitHub repository
3. Configure the following:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     ```
     VITE_API_URL=https://your-backend-url.onrender.com
     ```

### Android App

1. Update `android/app/src/main/java/com/localhub/app/config/ApiConfig.java` with your production API URL
2. Build the release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. The APK will be available at `android/app/build/outputs/apk/release/app-release.apk`

## Development Setup

### Backend

```bash
cd backend
npm install
# Create .env file with the following content:
# NODE_ENV=development
# PORT=5000
# DB_HOST=dpg-d0iad8p5pdvs73fodo70-a.singapore-postgres.render.com
# DB_PORT=5432
# DB_NAME=localhubdb
# DB_USER=localhub
# DB_PASSWORD=pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg
npm run dev
```

### Web Frontend

```bash
npm install
npm run dev
```

### Android

1. Open the project in Android Studio
2. Sync Gradle files
3. Run the app on an emulator or physical device

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=5000
DB_HOST=dpg-d0iad8p5pdvs73fodo70-a.singapore-postgres.render.com
DB_PORT=5432
DB_NAME=localhubdb
DB_USER=localhub
DB_PASSWORD=pftzZJtD46aG2kXHfbKsDkJHmJXsxKQg
JWT_SECRET=your-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Web Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

## API Documentation

The API documentation is available at `/api/docs` when running the backend server.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
