const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const connectDB = require('./config/db');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// CORS configuration (allow credentials, e.g. cookies)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allow both localhost and 127.0.0.1
  credentials: true
}));

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    const { password, ...safeBody } = req.body; // Don't log passwords
    console.log('Body:', safeBody);
  }
  next();
});

// Route files
const authRoutes = require('./routes/authRoutes');
const articleRoutes = require('./routes/articleRoutes');
const commentRoutes = require('./routes/commentRoutes');

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View routes
const { verifyJWT, optionalAuth } = require('./middleware/auth');
const Article = require('./models/Article');
const User = require('./models/User');

// Home page - all articles
app.get('/', optionalAuth, async (req, res) => {
  try {
    const articles = await Article.find().populate('author', 'username');
    res.render('articleList', { 
      articles, 
      user: req.user || null,
      title: 'All Articles'
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// My articles page
app.get('/my-articles', verifyJWT, async (req, res) => {
  try {
    const articles = await Article.find({ author: req.user._id }).populate('author', 'username');
    res.render('myArticles', { 
      articles, 
      user: req.user,
      title: 'My Articles'
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Article form (create/edit)
app.get('/articles/new', verifyJWT, (req, res) => {
  res.render('articleForm', { 
    user: req.user,
    article: null,
    title: 'Create Article'
  });
});

app.get('/articles/:id/edit', verifyJWT, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).render('error', { message: 'Article not found' });
    }
    
    if (article.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Not authorized' });
    }
    
    res.render('articleForm', { 
      user: req.user,
      article,
      title: 'Edit Article'
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Single article view
app.get('/articles/:id', optionalAuth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('author', 'username');
    if (!article) {
      return res.status(404).render('error', { message: 'Article not found' });
    }
    res.render('articleItem', { 
      article, 
      user: req.user || null,
      title: article.title
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Auth pages
app.get('/login', (req, res) => {
  res.render('login', { 
    user: null,
    title: 'Login'
  });
});

app.get('/register', (req, res) => {
  res.render('register', { 
    user: null,
    title: 'Register'
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/comments', commentRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
