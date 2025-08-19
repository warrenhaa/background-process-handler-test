module.exports = (sequelize, DataTypes) => {
  const users = sequelize.define('users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cognito_id: DataTypes.STRING,
    invite_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {});

  users.associate = (models) => {
    users.belongsTo(models.user_invitations, { foreignKey: 'invite_id', targetKey: 'id' });
    users.belongsTo(models.companies, { foreignKey: 'company_id' });
  };

  return users;
};
