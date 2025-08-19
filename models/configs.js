module.exports = (sequelize, DataTypes) => {
  const constants = sequelize.define('configs', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    key: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  },
  {
    freezeTableName: true,
    tableName: 'configs',
  });
  return constants;
};
