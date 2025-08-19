module.exports = (sequelize, DataTypes) => {
  const singleControlDevices = sequelize.define('single_control_devices', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    single_control_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants_groups',
        key: 'id',
      },
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    device_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'devices',
        key: 'id',
      },
    },
  },
  {
    freezeTableName: true,
    tableName: 'single_control_devices',
  });
  singleControlDevices.associate = (models) => {
    singleControlDevices.belongsTo(models.single_controls, { foreignKey: 'single_control_id', targetKey: 'id' });
    singleControlDevices.belongsTo(models.devices, { foreignKey: 'device_id', targetKey: 'id' });
  };
  return singleControlDevices;
};
