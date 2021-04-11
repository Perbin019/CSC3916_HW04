var express = require("express");
var bodyParser = require("body-parser");
var passport = require("passport");
var authController = require("./auth");
require("dotenv").config({ path: "./.env" });
var authJwtController = require("./auth_jwt");
var jwt = require("jsonwebtoken");
var cors = require("cors");
var User = require("./Users");
var Movie = require("./Movies");
const Review = require("./Reviews");
const { db } = require("./Users");

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
	var json = {
		headers: "No headers",
		key: process.env.UNIQUE_KEY,
		body: "No body",
	};

	if (req.body != null) {
		json.body = req.body;
	}

	if (req.headers != null) {
		json.headers = req.headers;
	}

	return json;
}

router.post("/signup", function (req, res) {
	if (!req.body.username || !req.body.password) {
		res.json({
			success: false,
			msg: "Please include both username and password to signup.",
		});
	} else {
		var user = new User();
		user.name = req.body.name;
		user.username = req.body.username;
		user.password = req.body.password;

		user.save(function (err) {
			if (err) {
				if (err.code === 11000) {
					return res.json({
						success: false,
						message: "A user with that username already exists",
					});
				}
				return res.json(err);
			}
			res.json({ success: true, msg: "Successfully created new user." });
		});
	}
});

router.post("/signin", function (req, res) {
	var userNew = new User();
	userNew.username = req.body.username;
	userNew.password = req.body.password;

	User.findOne({ username: userNew.username })
		.select("name username password")
		.exec(function (err, user) {
			if (err) {
				res.send(err);
			}

			user.comparePassword(userNew.password, function (isMatch) {
				if (isMatch) {
					var userToken = { id: user.id, username: user.username };
					var token = jwt.sign(userToken, process.env.SECRET_KEY);
					res.json({ success: true, token: "JWT " + token });
				} else {
					res
						.status(401)
						.send({ success: false, msg: "Authentication failed." });
				}
			});
		});
});

// router.use("/movies/:movieTitle", authJwtController.isAuthenticated);

router.delete("/movies/:movieTitle", (req, res) => {
	if (!req.params.movieTitle) {
		return res.json({ success: false, message: "Error: No title provided." });
	} else {
		Movie.findOneAndDelete(req.params.movieTitle, function (err, movie) {
			if (err) {
				return res
					.status(403)
					.json({ success: false, message: "Error: Error deleting movie. " });
			} else if (!movie) {
				return res.status(403).json({
					success: false,
					message: "Error: No movie found to delete. ",
				});
			} else {
				return res
					.status(200)
					.json({ success: true, message: "Successfully deleted title. " });
			}
		});
	}
});

router.get("/movies", function (req, res) {
	if (req.query.reviews == "true") {


				Movie.aggregate()
					// .match({ title: req.params.movieTitle })
					.lookup({
						from: "reviews",
						localField: "title",
						foreignField: "title",
						as: "reviews",
					})
                    .addFields({avgRating: {$avg: "$reviews.rating"}})
					.exec((err, result) => {
						if (err) {
							return res.status(400).json({ success: false, message: err });
						} else {
							if (result.length == 0) {
								return res.status(400).json({
									success: false,
									message: "No matching title or no reviews. ",
								});
							} else {
								return res.status(200).json(result);
							}
						}
					});


	} else {
		Movie.find({}, (err, movies) => {
			console.log("movies", movies);
			return res.status(200).json(movies);
		});
	}
});

router.get("/movies/:movieTitle",
	function (req, res) {
		console.log("movie: ", req.params.movieTitle);

		if (!req.params.movieTitle) {
			return res.json({ success: false, message: "Error: No title provided." });
		} else {
			console.log(req.query);

			if (req.query.reviews == "true") {
				Movie.aggregate()
					.match({ title: req.params.movieTitle })
					.lookup({
						from: "reviews",
						localField: "title",
						foreignField: "title",
						as: "reviews",
					})
                    .addFields({avgRating: {$avg: "$reviews.rating"}})
					.exec((err, result) => {
						if (err) {
							return res.status(400).json({ success: false, message: err });
						} else {
							if (result.length == 0) {
								return res.status(400).json({
									success: false,
									message: "No matching title or no reviews. ",
								});
							} else {
								return res.status(200).json(result);
							}
						}
					});
			} else {
				Movie.find({ title: req.params.movieTitle })
					.select("title year_released genre actors")
					.exec(function (err, movie) {
						if (err) {
							return res.status(403).json({
								success: false,
								message: "Unable to retrieve title passed in.",
							});
						}
						if (movie && movie.length > 0) {
							return res.status(200).json({
								success: true,
								message: "Successfully retrieved movie.",
								movie: movie,
							});
						} else {
							return res.status(404).json({
								success: false,
								message: "Unable to retrieve a match for title passed in.",
							});
						}
					});
			}
		}
	}
);

router.put("/movies", (req, res) => {
	if (!req.body.old_title || !req.body.updated_movie) {
		return res.json({
			success: false,
			message:
				"Error: Must pass movie title to be updated and fields to be updated. ",
		});
	} else {
		Movie.findOneAndUpdate(
			{ title: req.body.old_title },
			req.body.updated_movie,
			function (err, movie) {
				if (err) {
					return res.status(403).json({
						success: false,
						message: "Error: Unable to update movie. ",
					});
				} else if (!movie) {
					return res.status(403).json({
						success: false,
						message: "Error: Unable to find title to update. ",
					});
				} else {
					return res
						.status(200)
						.json({ success: true, message: "Successfully updated movie. " });
				}
			}
		);
	}
});

router.route("/movies")
	.post(authJwtController.isAuthenticated, function (req, res) {
		if (
			!req.body.title ||
			!req.body.year_released ||
			!req.body.genre ||
			!req.body.actors[0] ||
			!req.body.actors[1] ||
			!req.body.actors[2]
		) {
			return res.json({
				success: false,
				message:
					"Please include all information for title, year released, genre, and 3 actors.",
			});
		} else {
			var movie = new Movie();

			movie.title = req.body.title;
			movie.year_released = req.body.year_released;
			movie.genre = req.body.genre;
			movie.actors = req.body.actors;
			movie.imageUrl = req.body.imageUrl

			movie.save(function (err) {
				if (err) {
					if (err.code === 11000) {
						return res.json({
							success: false,
							message: "Error: The movie title already exists.",
						});
					} else {
						return res.send(err);
					}
				} else {
					return res
						.status(200)
						.send({ success: true, message: "Successfully created movie." });
				}
			});
		}
	})
	.all(function (req, res) {
		return res.status(403).json({
			success: false,
			message:
				"This HTTP method is not supported. Only GET, POST, PUT, and DELETE are supported.",
		});
	});

router.route("/reviews").post( function (req, res) {
		console.log('creating review')
		if (
			!req.body.title ||
			!req.body.name ||
			!req.body.quote ||
			!req.body.rating
		) {
			console.log('no good...', req.body)
			return res.json({
				success: false,
				message:
					"Error: You must include a movie title, a reviewer name, quote and rating. ",
			});
		} 
 
		let review = new Review(); 

		review.name = req.body.name;
		review.quote = req.body.quote; 
		review.rating = req.body.rating;
		review.title = req.body.title;
 
		Movie.findOne({ title: req.body.title }, (err, movie) => {
			if (err) { 
				return res
					.status(403)
					.json({ success: false, message: "Error creating review" });
			} else {
				if (!movie) {
					return res
						.status(403)
						.json({ success: false, message: "Unable to find movie title" });
				} else {
					review.save(function (err) {
						if (err) {
							return res.json({ success: false, message: "Error: " + err });
						} else {
							return res.status(200).send({
								success: true,
								message: "Successfully created review.",
							});
						}
					});
				}
			}
		});
	});

router.route("/reviews/:title").get((req, res) => {
	Review.find({ title: req.params.title })
		.select("name quote rating")
		.exec(function (err, review) {
			if (err) {
				return res.status(403).json({
					success: false,
					message: "Unable to retrieve title passed in.",
				});
			}
			if (review && review.length > 0) {
				return res.status(200).json({
					success: true,
					message: "Successfully retrieved review.",
					reviews: review,
				});
			} else {
				return res.status(404).json({
					success: false,
					message: "Unable to retrieve a match for title passed in.",
				});
			}
		});
});

router.all("/", function (req, res) {
	return res
		.status(403)
		.json({ success: false, msg: "This route is not supported." });
});

app.use("/", router);
app.listen(process.env.PORT || 8080);
console.log("Server running on port: ", process.env.PORT || 8080);
module.exports = app; // for testing only
