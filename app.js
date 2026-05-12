const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const FileStore = require('session-file-store')(session); 

const app = express();
const PORT = process.env.PORT;
const ADMIN_PASSWORD = 'rv2612';
const DATA_PATH = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

const defaultData = {
  title: "Riya - Portfolio", // Add this line
  about: "I'm a creative developer who builds polished web experiences.",
  skills: ['Node.js', 'Express', 'EJS', 'JavaScript', 'UI Design'],
  experience: [],
  projects: []
};

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      writeData(defaultData);
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (error) {
    return defaultData;
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin-login');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${Date.now()}-${safeName}${ext}`);
  }
});

const upload = multer({ storage });

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    store: new FileStore({ path: './sessions', retries: 0 }),
    secret: 'pink-glass-portfolio-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 }
}));

// --- ROUTES ---

app.get('/', (req, res) => res.render('index', { data: readData() }));
app.get('/admin-login', (req, res) => res.render('login', { error: null }));

app.post('/admin-login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/manage');
  }
  return res.status(401).render('login', { error: 'Incorrect Password' });
});

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/manage', requireAuth, (req, res) => {
  res.render('manage', { data: readData(), error: null });
});

app.post('/manage/about', requireAuth, (req, res) => {
  const data = readData();
  data.about = req.body.about || '';
  writeData(data);
  res.redirect('/manage#about-panel');
});

app.post('/manage/skills', requireAuth, (req, res) => {
  const data = readData();
  const skill = (req.body.skill || '').trim();
  if (skill) { data.skills.push(skill); writeData(data); }
  res.redirect('/manage#skills-panel');
});

app.post('/manage/skills/:index/delete', requireAuth, (req, res) => {
  const data = readData();
  data.skills.splice(req.params.index, 1);
  writeData(data);
  res.redirect('/manage#skills-panel');
});

app.post('/manage/experience', requireAuth, (req, res) => {
  const data = readData();
  data.experience.push(req.body);
  writeData(data);
  res.redirect('/manage#experience-panel');
});

app.post('/manage/experience/:index/delete', requireAuth, (req, res) => {
  const data = readData();
  data.experience.splice(req.params.index, 1);
  writeData(data);
  res.redirect('/manage#experience-panel');
});

// --- PROJECT & IMAGE MANAGEMENT ---

// Ensure 'images' matches the 'name' attribute in your HTML input
app.post('/manage/projects', requireAuth, upload.array('images', 20), (req, res) => {
  const data = readData();
  const uploadedFiles = (req.files || []).map((file) => file.filename);
  
  data.projects.unshift({
    id: `${Date.now()}`,
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    images: uploadedFiles
  });
  
  writeData(data);
  res.redirect('/manage#projects-panel');
});

// 1. DELETE THE ENTIRE PROJECT
app.post('/manage/projects/:id/delete', requireAuth, (req, res) => {
  const data = readData();
  const project = data.projects.find((item) => item.id === req.params.id);
  data.projects = data.projects.filter((item) => item.id !== req.params.id);
  if (project) {
    project.images.forEach((image) => {
      const imagePath = path.join(UPLOAD_DIR, image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    });
  }
  writeData(data);
  res.redirect('/manage#projects-panel');
});

/**
 * 2. DELETE A SPECIFIC IMAGE FROM A PROJECT (The Missing Part)
 * This handles the "x" button on individual images in the manage panel
 */
app.post('/manage/projects/:id/images/:imageName/delete', requireAuth, (req, res) => {
    const data = readData();
    const projectId = req.params.id;
    const imageName = req.params.imageName;

    // Find the project
    const project = data.projects.find(p => p.id === projectId);
    
    if (project) {
        // Filter out the image from the array in data.json
        project.images = project.images.filter(img => img !== imageName);
        
        // Physically delete the file from the public/uploads folder
        const imagePath = path.join(UPLOAD_DIR, imageName);
        if (fs.existsSync(imagePath)) {
            try {
                fs.unlinkSync(imagePath);
                console.log(`Deleted file: ${imageName}`);
            } catch (err) {
                console.error(`Error deleting file: ${err}`);
            }
        }
        
        writeData(data);
    }
    
    // Redirect back to the projects section of the manage page
    res.redirect('/manage#projects-panel');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});