module.exports = app => {
  const Users = app.db.models.Users;

  app.get("/users/:id", (req, res) => {
    Users.findById(req.params.id, {
      attributes: ["id", "name", "email"]
    })
    .then(result => res.json(result))
    .catch(error => {
      res.status(412).json({msg: error.message});
    });
  });

  app.delete("/users/:id", (req, res) => {
    Users.destroy({where: {id: req.params.id} })
      .then(result => res.sendStatus(204))
      .catch(error => {
        res.status(412).json({msg: error.message});
      });
  });

  app.post("/users", (req, res) => {
    Users.create(req.body)
      .then(result => res.json(result))
      .catch(error => {
        res.status(412).json({msg: error.message});
      });
  });
};
