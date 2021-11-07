// 'use strict';
//
// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;
//
// const userSchema = new Schema({
//   id: { type: String, minlength: 36, maxlength: 36 },
//   surname: {type: String },
//   name: {type: String},
//   login: {type: String, minlength: 3, maxlength: 36 },
//   password: {type: String, minlength: 3, maxlength: 36 }
// });
//
// const bill = new Schema({
//   amount: {type: Number}
// })
//
// const transaction = new Schema({
//   id: {type: String, minlength: 36, maxlength: 36},
//   from: {type: String, minlength: 36, maxlength: 36},
//   to: {type: String, minlength: 36, maxlength: 36},
//   amount: {type: Number},
//   timestamp: {type: Number},
// })
//
// // подключение
// //mongoose.connect("mongodb://root:example@localhost:27017/crm",
// //  { useUnifiedTopology: true, useNewUrlParser: true });
//
// // const User = mongoose.model("User", userScheme);
// // const user = new User({
// //   name: "Bill",
// //   age: 41
// // });
// //
// // user.save(function(err){
// //   mongoose.disconnect();  // отключение от базы данных
// //
// //   if(err) return console.log(err);
// //   console.log("Сохранен объект", user);
// // });
//
// module.exports = model;