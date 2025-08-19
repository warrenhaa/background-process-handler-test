module.exports = (sequelize, DataTypes) => {
  const cameraDevices = sequelize.define('camera_devices', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    camera_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    gateway_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    plan_code: {
      allowNull: true,
      type: DataTypes.STRING,
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
  cameraDevices.associate = function (models) {
    cameraDevices.belongsTo(models.companies, { foreignKey: 'company_id' });
    cameraDevices.belongsTo(models.occupants, { foreignKey: 'occupant_id', onDelete: 'CASCADE' });
    cameraDevices.belongsTo(models.devices, { as: 'gateway', foreignKey: 'gateway_id', targetKey: 'id' });
    cameraDevices.hasMany(models.device_alerts, { foreignKey: 'camera_device_id' });
    cameraDevices.hasMany(models.occupants_camera_permissions, { foreignKey: 'camera_device_id' });
  };
  return cameraDevices;
};
