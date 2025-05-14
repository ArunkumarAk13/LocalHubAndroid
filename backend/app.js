const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const ratingRoutes = require('./routes/ratings');
const chatRoutes = require('./routes/chats');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/chats', chatRoutes); 