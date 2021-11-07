'use strict';
const crypto = require('crypto');
const { v4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const privateKey = fs.readFileSync('private.key', 'utf8');

const express = require('express');
const app = express();
const jsonParser = express.json();

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  id: { type: String, minlength: 36, maxlength: 36 },
  surname: { type: String },
  name: { type: String },
  login: { type: String, minlength: 3, maxlength: 36 },
  password: { type: String, minlength: 3, maxlength: 36 }
});
const billSchema = new Schema({
  amount: { type: Number }
});
const transactionSchema = new Schema({
  id: { type: String, minlength: 36, maxlength: 36 },
  from: { type: String, minlength: 36, maxlength: 36 },
  to: { type: String, minlength: 36, maxlength: 36 },
  amount: { type: Number },
  timestamp: { type: Number },
});

mongoose.connect('mongodb://test1:test1@localhost:27017/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}, function (err, db) {
  if (err)
    console.log(err);
  else {
    console.log('Mongo Connected');
  }
});

const User = mongoose.model('User', userSchema);

app.post('/api/reg', jsonParser, async function (req, res) {

  const { name, surname, login, password } = req.body;

  try {
    let isReg = [];

    if (!(name & surname & login)) {
      isReg = await User.find({
        $and: [
          { name: name },
          { surname: surname },
          { login: login },
          //todo encode pass
          //{ password: password },
        ]
      });

    }
    else {
      return res.sendStatus(400);
    }

    if (isReg.length !== 0) {
      return res.status(409).send('Already registered');
    }

    const encryptedPass = crypto.createHash('md5').update(password).digest('hex');

    const user = await User.create({
      id: v4(),
      name: name,
      surname: surname,
      login: login,
      password: encryptedPass,
    });

    await user.save().catch(err => console.log(err));
    res.status(201).send(`New user registered ${user}`);

  }
  catch (err) {
    console.log(err);
  }
});
app.get('/api/authorize/:id', async function (req, res) {

  //const regId = req.params.id
  // const regId = await User.find({
  //    $and: [
  //      {name: req.query.name},
  //      {surname: req.query.surname}
  //    ]})

  if (req.params.id !== 0) {
    const [{ _doc: user }] = await User.find({ id: req.params.id });

    const token = jwt.sign({ name: user.name, surname: user.surname, id: user.id }, privateKey, { algorithm: 'HS256' });
    return res.send(`get token is done ${token}`);
  }

  return res.send('User not registered');

});

app.use(express.json());
app.use(function (req, res, next) {
    if (req.headers.authorization) {
      jwt.verify(
        req.headers.authorization.split(' ')[1],
        privateKey,
        async (err, payload) => {
          if (err) next();
          else if (payload) {
            const [{ _doc: user }] = await User.find({ id: payload.id });
            if (user.id === payload.id) {
              console.log('verify done')
              req.user = user;
              next();
            }
          }

          if (!req.user) next();
        }
      );
    }
    res.send('transaction');
    next()
}
);

app.post('/api/auth',  async (req, res) => {
  const { name, surname, login, password } = req.body;
  const [{ _doc: user }] = await User.find({
    $and: [
      { name: name },
      { surname: surname },
      { login: login },
      //todo encode pass
      //{ password: password },
    ]
  });

    if (
      login === user.login &&
      //todo encode
      password === user.password
    ) {
      return res.status(200).json({
        id: user.id,
        login: user.login,
       // token: jwt.sign({ id: user.id }, tokenKey),
      })
    }


  return res.status(404).json({ message: 'User not found' })
})

app.get('/user', (req, res) => {
  if (req.user) return res.status(200).json(req.user)
  else
    return res
      .status(401)
      .json({ message: 'Not authorized' })
})




app.listen(3000, function () {
  console.log('Start listen');
});