module.exports = (sequelize, DataTypes) => {
  const deviceReferences = sequelize.define('device_references', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    device_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    type: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    data: {
      allowNull: true,
      type: DataTypes.JSONB,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {});
  deviceReferences.associate = (models) => {
    deviceReferences.belongsTo(models.devices, { foreignKey: 'device_id' });
  };
  return deviceReferences;
};
