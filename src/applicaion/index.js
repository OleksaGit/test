'use strict';
const { HttpError } = require('./error');
const crypto = require('crypto');
const { v4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path')
//todo replace with env
const privateKey = fs.readFileSync('private.key', 'utf8');

const express = require('express');
const app = express();
//todo move to new page
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const LRU = require('lru-cache')
  , options = {
  max: 500
  , length: function (n, key) { return n * 2 + key.length; }
  , dispose: function (key, n) { n.close(); }
  , maxAge: 1000 * 60 * 60
}
  , cache = new LRU(options)
  , otherCache = new LRU(50);

const userSchema = new Schema({
  id: { type: String, minlength: 36, maxlength: 36 },
  surname: { type: String },
  name: { type: String },
  login: { type: String, minlength: 3, maxlength: 36 },
  password: { type: String, minlength: 3, maxlength: 36 },
  email: { type: String, minlength: 7 },
  amount: { type: Number },
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
}, (err) => {
  if (err)
    console.log(err);
  else {
    console.log('Mongo Connected');
  }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

app.use(express.json());

app.post('/api/reg', async function (req, res) {

  const { name, surname, login, password, email, amount } = req.body;
  try {
    let isReg = [];
    if (name && surname && login) {
      isReg = await User.find({ login: login });
      // isReg = await User.find({
      //   $and: [
      //     { name: name },
      //     { surname: surname },
      //     { login: login },
      //     //todo encode pass
      //     //{ password: password },
      //   ]
      // });
    }
    else return res.sendStatus(400);

    if (isReg.length !== 0) return res.status(409).send('Already registered');

    const encryptedPass = crypto.createHash('md5').update(password).digest('hex');
    const user = await User.create({
      id: v4(),
      name: name,
      surname: surname,
      login: login,
      password: encryptedPass,
      email: email,
      amount: Number(amount),
    });

    await user.save().catch(err => console.log(err));
    res.status(201).send(`New user registered ${user}`);

  }
  catch (err) {
    console.log(err);
  }
});

// app.get('/api/authorize/:id', async function (req, res) {
//
//   //const regId = req.params.id
//   // const regId = await User.find({
//   //    $and: [
//   //      {name: req.query.name},
//   //      {surname: req.query.surname}
//   //    ]})
//
//   if (req.params.id !== 0) {
//     const [{ _doc: user }] = await User.find({ id: req.params.id });
//
//     const token = jwt.sign({ name: user.name, surname: user.surname, id: user.id }, privateKey, { algorithm: 'HS256' });
//     return res.send(`get token is done ${token}`);
//   }
//
//   return res.send('User not registered');
//
// });

app.post('/api/auth', async (req, res, next) => {
  const { login, password } = req.body;
  const encryptedPass = crypto.createHash('md5').update(req.body.password).digest('hex');
  const [{ _doc: user }] = await User.find({
    $and: [
      // { name: name },
      // { surname: surname },
      { login: login },
      { password: encryptedPass },
    ]
  });

  if (
    login === user.login &&
    encryptedPass === user.password
  ) {
    const token = jwt.sign({ name: user.name, surname: user.surname, id: user.id }, privateKey, { algorithm: 'HS256' });
    return res.status(200).json({
      id: user.id,
      login: user.login,
      token: token
    });
  }
  next(new HttpError(404, 'User not found'));
});

//todo replace all block code
app.use(function (req, res, next) {
    if (req.headers.authorization) {
      jwt.verify(
        req.headers.authorization.split(' ')[1],
        privateKey,
        async (err, payload) => {
          if (err) {
            next(new HttpError(401, 'Invalid token'));
          }
          else {
            // const [{ _doc: user }] = await User.find({ id: payload.id });
            // if (user.id === payload.id) {
            console.log('verify done');
            req.user = payload;
            next();
          }
        }
      );
    }
    //next(new HttpError (401, 'Invalid authorisation headers')); //err
  }
);

app.post('/api/transaction/', async function (req, res) {
  const { to: client, payment } = req.body;
  const [{ _doc: userReceivesPay }] = await User.find({ id: client });
  const [{ _doc: userGivePay }] = await User.find({ id: req.user.id });
  const billUserReceives = userReceivesPay.amount + Number(payment);
  const billUserGive = userGivePay.amount - Number(payment);

  await User.updateOne({ id: client }, { $set: { amount: billUserReceives } });
  await User.updateOne({ id: req.user.id }, { $set: { amount: billUserGive } });

  const transactionId = v4();
  await Transaction.insertMany({
    id: transactionId,
    from: userGivePay.id,
    to: userReceivesPay.id,
    amount: Number(payment),
    timestamp: Date.now(),
  });

  await fs.writeFile(`../transactions/transaction_${transactionId}.txt`,
    `Transaction №${transactionId}\n
   From: ${userGivePay.name} ${userGivePay.surname}\n
   To: ${userReceivesPay.name} ${userReceivesPay.surname}\n
   Amount: ${payment}`,
    (err) => {
      if (err) throw err;
      console.log('write file ok');
    }
  );

  return res.send('Payment done');

});

app.get('/api/history/:id', async function (req, res) {
  if (req.params.id) {
    const userTransaction = await Transaction.find({ from: req.params.id });
    let result = [];
    for (let i = 0; i < userTransaction.length; i++) {
      const [{ _doc: { name, surname } }] = await User.find({ id: userTransaction[i]._doc.from });
      const resultObj = {
        to: { name, surname },
        amount: userTransaction[i]._doc.amount,
        timestamp: userTransaction[i]._doc.timestamp,
        id: userTransaction[i]._doc.id,
      };
      result.push(resultObj);
    }
    res.send(result);
  }
});

app.get('/api/get_doc/:docId', async function (req,res) {
  if (req.params.docId) {
    const transactionDoc = path.resolve(`../transactions/transaction_${req.params.docId}.txt`)
    fs.open(transactionDoc, 'r', (err, fd) => {
      if (err) {
        if (err.code === 'ENOENT') {
          console.error('file does not exist');
          return res.send('doc not found');
        }
        throw err;
      } else {
        res.sendFile(transactionDoc)
      }
    })
  }
 // new HttpError (400, 'bad request');
}) 

app.use(function (err, req, res, next) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
  }
  else {
    res.status(500).json({ message: err.message });
  }
});

app.listen(3000, function () {
  console.log('Start listen');
});