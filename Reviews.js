const mongoose = require('mongoose');
var Schema = mongoose.Schema;


//mongoose.connect(process.env.DB, { useNewUrlParser: true });
try {
    mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true }, () =>
        console.log("connected"));
} catch (error) {
    console.error("could not connect");
}
mongoose.set('useCreateIndex', true);


//    Movie Schema
const ReviewSchema = new Schema({
    title: String,
    name: String,
    quote: String,
    rating: Number
});

ReviewSchema.pre('save', function (next) {
    next();
});

//return the model to server
module.exports = mongoose.model('Review', ReviewSchema); 