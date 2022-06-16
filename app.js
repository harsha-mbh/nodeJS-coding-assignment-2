const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "codingassignment2", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `
SELECT * FROM user
WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO user
          (username, name, gender, password)
          VALUES(
              '${username}',
              '${name}',
              '${gender}',
              '${hashedPassword}'
          );`;
      const newUser = await db.run(createUserQuery);
      const newUserId = newUser.lastId;
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
SELECT * FROM user
WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "codingassignment2");
      response.send({ jwtToken });
    }
  }
});

///API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;
  const getTweetsQuery = `
  SELECT T.username AS username,
  tweet.tweet AS tweet,
  tweet.date_time AS dateTime
  FROM (user INNER JOIN follower ON user.user_id = follower.following_user_id) AS T 
  INNER JOIN tweet ON T.following_user_id = tweet.user_id
  WHERE follower.follower_user_id = ${userId}
  ORDER BY tweet.date_time DESC
  LIMIT 4;`;
  const tweetsArray = await db.all(getTweetsQuery);
  response.send(tweetsArray);
});

///API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;
  const getFollowingQuery = `
  SELECT user.name AS name
  FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${userId};`;
  const followingArray = await db.all(getFollowingQuery);
  response.send(followingArray);
});

///API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;
  const getFollowersQuery = `
  SELECT user.name AS name
  FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id
  WHERE follower.following_user_id = ${userId};`;
  const followersArray = await db.all(getFollowersQuery);
  response.send(followersArray);
});

///API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;
  const { tweetId } = request.params;
  const verifyRequestQuery = `
  SELECT * FROM (follower INNER JOIN user ON follower.following_user_id = user.user_id) AS T
  LEFT JOIN tweet ON T.user_id = tweet.user_id
  WHERE follower.follower_user_id = ${userId} and tweet_id = ${tweetId};`;
  const verifiedTweet = await db.get(verifyRequestQuery);
  if (verifiedTweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const checkFollowingQuery = `
  SELECT tweet, COUNT(like_id) AS likes, COUNT(reply_id) AS replies, tweet.date_time AS dateTime
  FROM (follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id
  LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id 
  LEFT JOIN like ON tweet.tweet_id = like.tweet_id)
  WHERE follower.follower_user_id = ${userId} AND tweet.tweet_id = ${tweetId}
  GROUP BY tweet.tweet_id;`;
    const tweets = await db.get(checkFollowingQuery);
    response.send(tweets);
  }
});

///API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
    const dbUser = await db.get(getUserQuery);
    const userId = dbUser.user_id;
    const verifyRequestQuery = `
  SELECT * FROM (follower INNER JOIN user ON follower.following_user_id = user.user_id) AS T
  LEFT JOIN tweet ON T.user_id = tweet.user_id
  WHERE follower.follower_user_id = ${userId} and tweet_id = ${tweetId};`;
    const verifiedTweet = await db.get(verifyRequestQuery);
    if (verifiedTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getLikesDetails = `
   SELECT user.username AS likes FROM ( user INNER JOIN follower ON user.user_id = follower.following_user_id)AS T LEFT JOIN tweet 
   ON T.following_user_id = tweet.user_id LEFT JOIN like ON tweet.tweet_id = like.tweet_id
   WHERE T.follower_user_id = ${userId} AND tweet.tweet_id = ${tweetId};`;
      const likes = await db.all(getLikesDetails);
        response.send(likes);
    }
  }
);

///API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
    const dbUser = await db.get(getUserQuery);
    const userId = dbUser.user_id;
    const verifyRequestQuery = `
  SELECT * FROM (follower INNER JOIN user ON follower.following_user_id = user.user_id) AS T
  LEFT JOIN tweet ON T.user_id = tweet.user_id
  WHERE follower.follower_user_id = ${userId} and tweet_id = ${tweetId};`;
    const verifiedTweet = await db.get(verifyRequestQuery);
    if (verifiedTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getLikesDetails = `
   SELECT user.username AS likes, reply.reply AS reply FROM ( user INNER JOIN follower ON user.user_id = follower.following_user_id)AS T LEFT JOIN tweet 
   ON T.following_user_id = tweet.user_id LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
   WHERE T.follower_user_id = ${userId} AND tweet.tweet_id = ${tweetId}
   GROUP BY T.user_id;`;
      const replies = await db.all(getLikesDetails);
        response.send(replies);
      }
    }
);

///API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;

  const getTweetsQuery = `SELECT tweet, COUNT(like_id) AS likes, COUNT(reply_id) AS replies,
  tweet.date_time AS dateTime 
  FROM (tweet LEFT JOIN like on tweet.tweet_id = like.tweet_id) AS T LEFT JOIN reply ON 
  tweet.tweet_id = reply.tweet_id
  WHERE tweet.user_id = ${userId}
  GROUP BY tweet.tweet_id;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const dateTime = new Date();
  const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser.user_id;
  const createTweetQuery = `
  INSERT INTO tweet(tweet, user_id, date_time)
  VALUES('${tweet}', ${userId}, '${dateTime}');`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

///API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT *
 FROM user
 WHERE username = '${username}';`;
    const dbUser = await db.get(getUserQuery);
    const userId = dbUser.user_id;
    const getUserTweet = `
SELECT * FROM tweet
WHERE tweet_id = ${tweetId} AND user_id = ${userId};`;
    const tweet = await db.get(getUserTweet);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
