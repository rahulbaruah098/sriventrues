const appDatabase = db.getSiblingDB('sri_website');
appDatabase.createUser({
  user: 'sri_app',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'sri_website' }]
});
