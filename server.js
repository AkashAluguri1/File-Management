const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const bodyParser = require('body-parser');
const mysql = require('mysql');
const session = require('express-session');

const app = express();
const PORT = 5000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static('public'));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'filemanagement',
});

app.use(session({
  secret: '123', 
  resave: false,
  saveUninitialized: true,
}));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private, no-cache, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  next();
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});


// // Multer configuration for file uploads
// const storage = multer.diskStorage({
//   destination: 'public/uploads/',
//   filename: function (req, file, cb) {
//     // cb(null, Date.now() + path.extname(file.originalname));
    
//     cb(null, file.originalname);
//   },
// });

// const upload = multer({ storage: storage });


// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     // Get the username or user ID from the session (replace with your actual session key)
//     const username = req.session.userName;

//     // Create a folder for each user if it doesn't exist
//     const userFolder = path.join('public/uploads/', username);
//     if (!fs.existsSync(userFolder)) {
//       fs.mkdirSync(userFolder);
//     }

//     // Set the destination to the user's folder
//     cb(null, userFolder);
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   },
// });

const getStorage = () => {
  
  return multer.diskStorage({
    destination: function (req, file, cb) {
      // Create a folder for each user if it doesn't exist
      const userFolder = path.join('public/uploads/default');
      
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder);
      }

      // Set the destination to the user's folder
      cb(null, userFolder);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });
};

// const upload = multer({ storage: storage });

let upload = multer({ storage: getStorage() });

const getStorageForUser = (username) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const userFolder = path.join('public/uploads/', username);
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }
      cb(null, userFolder);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });
};


//pages

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    // res.status(401).json({ status: 'error', message: 'Access denied. Please log in.' });
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }

  
});

app.get('/protected', (req, res) => {
  // Check if user is logged in
  if (req.session.user) {
    res.json({ status: 'ok', message: 'Access granted to protected route' });
  } else {
    res.status(401).json({ status: 'error', message: 'Access denied. Please log in.' });
  }
});

//logout
app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.json({ status: 'error', message: 'Failed to log out' });
    } else {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
      res.redirect('/');
      // res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
  });
});


//login route

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;
  db.query(sql, [email, password], (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      req.session.user = { email };

      const query = 'SELECT * FROM users WHERE email = ?';
      db.query(query, [email], (queryError, results) => {
        // console.log(results)
        if (results.length > 0) {
          req.session.userName = results[0].name ;
          console.log(req.session.userName)
          res.json({ 'status': 'ok', 'userName' :  req.session.userName });
        }
        
      });

      
      
      // res.redirect('/dashboard');
    } else {
      res.json({ 'status': 'error', 'message' : 'Invalid email or password' });
    }
  });
});


//signup
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
  db.query(sql, [name, email, password], (err, result) => {
    if (err)
    {
      res.json({ 'status': 'error', 'message' : err.message });
    } 
    else{
      res.json({ 'status': 'ok' });
    }
  });
});


// Upload route
// app.post('/upload', upload.single('file'), (req, res) => {
//   // res.send('File uploaded successfully!');
//   res.json({ 'status': 'ok' });
// });

app.post('/upload', (req, res) => {

  req.upload = multer({ storage: getStorageForUser(req.session.userName) });


  if (req.upload) {
    // Use the upload middleware with the user-specific storage
    req.upload.single('file')(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(500).json({ error: err.message });
      } else if (err) {
        return res.status(500).json({ error: 'Something went wrong!' });
      }
      res.json({ status: 'ok' });
    });
  } else {
    // User is not logged in, use the default upload middleware
    upload.single('file')(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(500).json({ error: err.message });
      } else if (err) {
        return res.status(500).json({ error: 'Something went wrong!' });
      }
      res.json({ status: 'ok' });
    });
  }
});

// Download route
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/uploads/' + req.session.userName, req.params.filename);
  res.download(filePath);
});

app.delete('/delete/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, 'public/uploads/' + req.session.userName, fileName);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Delete the file
    fs.unlinkSync(filePath);
    res.json({ status: 'ok', message: 'File deleted successfully' });
  } else {
    res.status(404).json({ status: 'error', message: 'File not found' });
  }
});

app.get('/share/:filename/:recipent', (req, res) => {
  const fileName = req.params.filename;
  const sourcePath = path.join(__dirname, 'public/uploads/' + req.session.userName, fileName);
  let destinationPath = path.join(__dirname, 'public/uploads/' + req.params.recipent);

  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
  }

  let destinationPath2 = path.join(__dirname, 'public/uploads/' + req.params.recipent, "shared_" + req.session.userName + "_" + fileName);

  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(destinationPath2);

  readStream.pipe(writeStream);

  writeStream.on('finish', () => {
    console.log('File copied successfully.');
    res.json({ status: 'ok', message: 'File shared successfully' });
  });

  readStream.on('error', (err) => {
    console.error('Error writing file:', err);
    res.json({ status: 'error', message: err.message });
  });

  writeStream.on('error', (err) => {
    console.error('Error writing file:', err);
    res.json({ status: 'error', message: err.message });
  });

  
  
});


// List files route
app.get('/files', (req, res) => {
  const uploadDir = path.join(__dirname, 'public/uploads/' + req.session.userName);
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ files: files });
  });
});

app.get('/users', (req, res) => {
  const loggedInUser = req.session.user; 

  const sql = 'SELECT * FROM users WHERE email <> ?';
  db.query(sql, [loggedInUser], (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      res.json({ 'status' : 'ok',  'message': 'Internal Server Error' });
    }
    else
    {
      res.json({ 'status' : 'ok',  'message': results });
    }
  });
});

app.get('/user', (req, res) => {
  const loggedInUser = req.session.userName; 

  res.json({ 'status' : 'ok',  'message': loggedInUser });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
