module.exports = (sequelize, DataTypes) => {
  const occupantCameraPermissions = sequelize.define('occupants_camera_permissions', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    camera_device_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
    },
    occupant_permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
    },
    access_level: {
      type: DataTypes.STRING,
      allowNull: true,
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
      tableName: 'occupants_camera_permissions',
    });
    occupantCameraPermissions.associate = (models) => {
      occupantCameraPermissions.belongsTo(models.occupants_permissions, {foreignKey: 'occupant_permission_id', onDelete: 'CASCADE', targetKey: 'id'});
      occupantCameraPermissions.belongsTo(models.camera_devices, { foreignKey: 'camera_device_id', onDelete: 'CASCADE', targetKey: 'id' });
  };
  return occupantCameraPermissions;
};
