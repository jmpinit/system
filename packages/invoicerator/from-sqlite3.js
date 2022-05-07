/**
 * Retrieves entries between the given start and end dates (inclusive).
 * @param db - sqlite3 database with time log entries
 * @param startDate
 * @param endDate
 * @returns {Promise<unknown>}
 */
async function getEntriesBetween(db, startDate, endDate) {
  const startFromEpoch = startDate.getTime();
  const endFromEpoch = endDate.getTime();

  return new Promise((fulfill, reject) => {
    db.all('SELECT * FROM main WHERE date BETWEEN ? AND ? ORDER BY date ASC', [startFromEpoch, endFromEpoch], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      fulfill(rows);
    });
  });
}

module.exports = {
  getEntriesBetween,
};
