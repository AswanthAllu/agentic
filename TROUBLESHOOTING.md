# TutorAI Troubleshooting Guide

This guide helps you resolve common issues when setting up and using TutorAI.

## 🚨 Common Issues and Solutions

### 1. "Error: Failed to get a response from the AI" or Empty Responses

**Symptoms:**
- Sending "hi" or any prompt returns an error
- Chat interface shows error messages instead of AI responses
- Console shows Gemini API errors

**Solutions:**

#### A. Check API Key Configuration
1. Verify your `.env` file exists in the `server` directory
2. Ensure your `GEMINI_API_KEY` is correctly set:
   ```bash
   # In server/.env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Get a valid API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. Restart the server after updating the API key

#### B. Verify API Key Validity
```bash
# Test your API key with curl
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     -X POST "https://generativeai.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
```

#### C. Check Package Installation
```bash
cd server
npm list @google/generative-ai
# Should show the package is installed, not empty
```

If empty, reinstall:
```bash
npm install @google/generative-ai
```

### 2. Server Won't Start

**Symptoms:**
- `npm run dev` fails
- Port already in use errors
- MongoDB connection errors

**Solutions:**

#### A. Port Issues
```bash
# Check if port 5007 is in use
lsof -i :5007

# Kill process using the port
kill -9 <PID>

# Or change port in .env file
PORT=3001
```

#### B. MongoDB Issues
```bash
# Start MongoDB
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Check MongoDB status
mongosh
```

#### C. Missing Dependencies
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

### 3. Client Won't Start or Connect

**Symptoms:**
- React app won't start
- Can't connect to backend
- CORS errors

**Solutions:**

#### A. Install Client Dependencies
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

#### B. Check API Base URL
Verify in `client/src/services/api.js` that the base URL matches your server:
```javascript
const API_BASE_URL = 'http://localhost:5007/api';
```

#### C. CORS Issues
Server is configured for CORS, but if issues persist, verify in `server/server.js`:
```javascript
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
```

### 4. Authentication Issues

**Symptoms:**
- "Unauthorized" errors
- Can't create sessions
- Login page issues

**Solutions:**

#### A. Create a Test User
```bash
# Connect to MongoDB
mongosh
use chatbotGeminiDB4

# Create a test user
db.users.insertOne({
  username: "testuser",
  email: "test@example.com",
  password: "hashedpassword",
  createdAt: new Date()
})
```

#### B. Check JWT Configuration
Ensure `JWT_SECRET` is set in your `.env` file:
```env
JWT_SECRET=your_secure_random_string_here
```

### 5. File Upload Issues

**Symptoms:**
- Files won't upload
- Upload progress stuck
- File processing errors

**Solutions:**

#### A. Check File Size Limits
Default limit is 50MB. Adjust in `.env`:
```env
MAX_FILE_SIZE=100
```

#### B. Verify Upload Directory
```bash
# Check if upload directory exists
ls -la server/public/
mkdir -p server/public/uploads
```

#### C. File Type Issues
Supported formats: PDF, DOCX, PPTX, TXT
Check file extension and MIME type validation.

### 6. Database Issues

**Symptoms:**
- Can't save chat history
- Session data not persisting
- MongoDB connection errors

**Solutions:**

#### A. MongoDB Connection
```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017/chatbotGeminiDB4
```

#### B. Database Permissions
```bash
# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

#### C. Clear Database (if needed)
```bash
mongosh
use chatbotGeminiDB4
db.dropDatabase()
```

## 🔍 Debug Mode

Enable detailed logging by setting in your `.env`:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 📊 Health Check

Visit these URLs to verify your setup:
- Server health: `http://localhost:5007/`
- API status: `http://localhost:5007/api/network`

## 🆘 Getting More Help

1. **Check Console Logs:** 
   - Browser Developer Tools (F12) → Console tab
   - Server terminal output

2. **Enable Verbose Logging:**
   ```bash
   # In server directory
   DEBUG=* npm run dev
   ```

3. **Test Individual Components:**
   ```bash
   # Test database connection
   node -e "require('./config/db')('mongodb://localhost:27017/chatbotGeminiDB4')"
   
   # Test API key
   node -e "console.log(process.env.GEMINI_API_KEY)" 
   ```

4. **Reset Everything:**
   ```bash
   # Complete reset
   rm -rf node_modules package-lock.json
   rm server/.env
   node setup-env.js
   npm install
   ```

## 🐛 Still Having Issues?

If you're still experiencing problems:

1. Check the [GitHub Issues](https://github.com/your-repo/issues) page
2. Create a new issue with:
   - Error messages (with sensitive info removed)
   - Your operating system
   - Node.js version (`node --version`)
   - Steps to reproduce the problem

Remember to **never share your API keys** or other sensitive information in issue reports!