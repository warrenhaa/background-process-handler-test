module.exports = (sequelize, DataTypes) => {
  const model = sequelize.define('models', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    notification_emails: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    description: {
      type: DataTypes.STRING,
    },
    company_id: {
      type: DataTypes.UUID,
    },
  }, {});

  model.associate = (models) => {
    model.belongsTo(models.companies, { foreignKey: 'company_id' });
  };

  return model;
};
