module.exports = (sequelize, DataTypes) => {
  const DevicesAlerts = sequelize.define('device_alerts', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    alert_type: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    alert_code: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    severity: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    company_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    device_id: {
      allowNull: true,
      type: DataTypes.UUID,
    },
    is_viewed: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN,
    },
    camera_device_id: {
      allowNull: true,
      type: DataTypes.UUID,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {
    sequelize,
    modelName: 'device_alerts',
  });
  DevicesAlerts.associate = function (models) {
    DevicesAlerts.belongsTo(models.companies, { foreignKey: 'company_id', onDelete: 'CASCADE' });
    DevicesAlerts.belongsTo(models.devices, { foreignKey: 'device_id', onDelete: 'CASCADE' });
    DevicesAlerts.belongsTo(models.camera_devices, { foreignKey: 'camera_device_id', onDelete: 'CASCADE' });
  };
  return DevicesAlerts;
};
