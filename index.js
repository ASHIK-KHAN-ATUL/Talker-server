const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wrydc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// console.log(process.env.DB_USER)
// console.log(process.env.DB_PASS)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db('talker').collection('users')
    const postsCollection = client.db('talker').collection('posts')
    const commentCollection = client.db('talker').collection('comment')


    // jwt related apis
    app.post('/jwt', async(req, res)=> {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'24h'});
      res.send({token});
    })

    // middleWares 
    const verifyToken = (req, res, next) => {
      // console.log('Inside Verify Token',req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'Frobidden Acces'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=> {
        if(err){
          return res.status(401).send({message: 'frobidden Acces'})
        }
        req.decoded = decoded;
        next();
      })
      
    }


    // create user
    app.post('/users', async(req, res)=> {
      const user = req.body;
      const query = {email:user.email}
      const existinguser = await usersCollection.findOne(query);
      if(existinguser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    app.get('/users', async(req, res)=> {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    
    app.get('/users/:email', async(req, res)=>{
      const email = req.params.email;
      const filter = {email: email};
      const result = await usersCollection.findOne(filter);
      res.send(result);
    })

    // upload / Update My cover photo
    app.patch('/users/cover/:email', verifyToken, async(req, res)=> {
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({ message: "Forbidden: You can't update others' profile" });
      }
      const {coverPhoto} = req.body;
      const result = await usersCollection.updateOne(
        {email}, 
        {$set:{coverPhoto: coverPhoto}}
      );
      res.send(result);
    })

    //  My profile Visit
    app.get('/users/user/:email', verifyToken,  async(req, res)=> {
      const email = req.params.email;
      const filter = {email: email};
      const result = await usersCollection.findOne(filter);
      res.send(result);
    })

    // visited user profile
    app.get('/users/user/visit/:id', async(req, res)=> {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await usersCollection.findOne(filter);
      res.send(result);
    })

    // post create 
    app.post('/talker/posts', verifyToken, async(req, res)=> {
      const post = req.body;
      const result = await postsCollection.insertOne(post);
      res.send(result);
    })

    // Get all post 
    app.get('/posts', async(req, res)=>{
      const result = await postsCollection.find().sort({postCreateAt: -1}).toArray();
      res.send(result);
    })

    // get only mypost
    app.get('/posts/user/:email', verifyToken, async(req, res)=> {
      const email = req.params.email;
      const filter = {authorEmail: email};
      const result = await postsCollection.find(filter).sort({postCreateAt: -1}).toArray();
      res.send(result);
    })

    // get post from visited profile
    app.get('/posts/user/visit/:id', verifyToken, async(req, res)=>{
      const visitedId = req.params.id;
      const filter = {author_id: visitedId}
      const result = await postsCollection.find(filter).sort({postCreateAt: -1}).toArray();
      res.send(result);
    })

    // get only image from mypost
    app.get('/posts/image/user/:email', verifyToken, async(req, res)=> {
      const email = req.params.email;
      const filter = {
        authorEmail: email,
        postImage: {$exists: true, $ne:""}
      };
      const result = await postsCollection.find(filter).sort({postCreateAt: -1}).toArray();
      res.send(result);
    })

    // get only image from visited Profile 
    app.get('/posts/image/user/visit/:id', verifyToken, async(req,res)=>{
      const visitedId = req.params.id;
      const filter = {
        author_id: visitedId,
        postImage: {$exists: true, $ne:""}
      };
      const result = await postsCollection.find(filter).sort({postCreateAt: -1}).toArray();
      res.send(result);
    })

    // post like/ undoLike
    app.patch('/posts/:id/like', verifyToken, async(req, res)=> {
      const postId = req.params.id;
      const {userId} = req.body;
      const post = await postsCollection.findOne({_id: new ObjectId(postId)});
      if(!post){
        return res.status(404).send({message: 'Post Not Found'});
      }

      const alreadyLiked = post.likes.includes(userId);
      if(!alreadyLiked){
        await postsCollection.updateOne(
          {_id: new ObjectId(postId)},
          {$push: {likes: userId}}
        );
      }
      else{
        await postsCollection.updateOne(
          {_id: new ObjectId(postId)},
          {$pull: {likes:userId}}
        );
      }
      res.send({seccess: true, liked: !alreadyLiked});
    })

    // single post/ details post
    app.get('/posts/singlepost/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await postsCollection.findOne(filter);
      res.send(result);
    })

    // Post Delete
    app.delete('/posts/post/:id', async(req, res)=> {
      const postId = req.params.id;
      const filter = {_id: new ObjectId(postId)};
      const result = await postsCollection.deleteOne(filter);
      res.send(result);
    })

    // post a Comments
    app.post('/comments', verifyToken, async(req, res)=> {
      const newComment = req.body;
      const result = await commentCollection.insertOne(newComment);
      res.send(result);
    })

    // get comments on a post
    app.get('/comments/post/:id', verifyToken, async(req, res)=> {
      const postId = req.params.id;
      const filter = {postId}
      const result = await commentCollection.find(filter).toArray();
      res.send(result);
    })

    // My followers
    app.get('/users/user/:id/followers', async(req, res)=> {
      const id = req.params.id;
      const followers = await usersCollection.find(
        {following: id},
        {projection:{name:1, image:1, email:1}}
       ).toArray();
      res.send(followers)
    })

    // Visited Profile follower
    app.get('/users/user/visit/:id/followers', async(req, res)=>{
      const visitedId = req.params.id;
      const followers = await usersCollection.find({following: visitedId}, {projection:{name:1, image:1, email:1}}).toArray();
      res.send(followers);
    })

    // My following
    app.post('/users/user/following/details', async(req, res)=>{
      const {ids} = req.body;
      const objectIds = ids.map(id => new ObjectId(id));
      const users = await usersCollection.find({_id:{$in: objectIds}}).project({name:1, image:1, email:1}).toArray();
      res.send(users);
    })

    // user data update
    app.patch('/users/user/update/:email', verifyToken, async(req, res)=>{
      const email = req.params.email;
      const updateData = req.body;
      const result = await usersCollection.updateOne({email:email}, {$set:updateData});
      res.send(result);
    })

    // Follow others
    app.patch('/users/user/follow/:email', async(req, res)=> {
      const email = req.params.email;
      const {followingId} = req.body;
      const filter ={email:email}
      const user = await usersCollection.findOne(filter);
      const alreadyFollow = user.following.includes(followingId);
      if (!followingId) {
        return res.status(400).send({ message: "followingId is required" });
      }
      if(!user){
        return res.status(404).send({message: "User not Found"})
      }
      if(!alreadyFollow){
        await usersCollection.updateOne(filter, {$push:{following:followingId}})
      }else{
        await usersCollection.updateOne(filter, {$pull:{following:followingId}})
      }
      res.send({success:true, following: !alreadyFollow})
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=> {
    res.send('Talker is Open for talk')
})

app.listen(port, () => {
    console.log(`Talker is running on Port :${port}`)
})