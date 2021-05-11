const db = require('../db/connection');
const { checkExists } = require('./utils');
const { validateSortBy, validateOrder } = require('../utils');

exports.selectArticles = async ({
  sort_by = 'created_at',
  order = 'desc',
  topic,
  p = 1,
  limit = 10,
}) => {
  const validSortBy = await validateSortBy(sort_by, [
    'created_at',
    'votes',
    'title',
  ]);
  const validOrder = await validateOrder(order);
  const offset = (p - 1) * limit;
  const dbQueryParams = [offset, limit];

  let queryStr = `SELECT articles.*,
  COUNT(comments.comment_id) AS comment_count
  FROM articles
  LEFT JOIN comments ON comments.article_id = articles.article_id
`;

  if (topic) {
    queryStr += `WHERE articles.topic ILIKE $3`;
    dbQueryParams.push(topic);
  }

  queryStr += `
  GROUP BY articles.article_id
  ORDER BY ${validSortBy} ${validOrder}
  OFFSET $1 LIMIT $2;`;

  const articles = await db
    .query(queryStr, dbQueryParams)
    .then((result) => result.rows);

  if (!articles.length) {
    await checkExists('topics', 'slug', topic);
  }
  return articles;
};

exports.countArticles = async ({ topic }) => {
  let queryStr = `SELECT COUNT('*') FROM articles `;
  const queryParams = [];

  if (topic) {
    queryStr += `WHERE articles.topic ILIKE $1`;
    queryParams.push(topic);
  }

  const count = await db
    .query(queryStr, queryParams)
    .then((result) => Number(result.rows[0].count));
  return count;
};

exports.selectArticleById = async (article_id) => {
  const queryStr = `SELECT articles.*, COUNT(comment_id) AS comment_count
  FROM articles
  LEFT JOIN comments ON comments.article_id = articles.article_id
  WHERE articles.article_id = $1
  GROUP BY articles.article_id
  LIMIT 1;`;

  const article = await db
    .query(queryStr, [article_id])
    .then((result) => result.rows[0]);

  if (!article) {
    return Promise.reject({ status: 404, msg: 'article_id not found' });
  }
  return article;
};

exports.updateArticleById = async (article_id, { inc_votes = 0 }) => {
  const article = await db
    .query(
      `UPDATE articles SET votes = votes + $1 WHERE article_id = $2 RETURNING *;`,
      [inc_votes, article_id]
    )
    .then((result) => result.rows[0]);

  if (!article) {
    return Promise.reject({
      status: 404,
      msg: `Article with id: ${article_id} not found`,
    });
  }

  return article;
};