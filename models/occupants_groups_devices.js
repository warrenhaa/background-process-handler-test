module.exports = (sequelize, DataTypes) => {
  const occupantGroupDevices = sequelize.define('occupants_groups_devices', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    occupant_group_id: {
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
      tableName: 'occupants_groups_devices',
    });
  occupantGroupDevices.associate = (models) => {
    occupantGroupDevices.belongsTo(models.occupants_groups, { foreignKey: 'occupant_group_id', targetKey: 'id' });
    occupantGroupDevices.belongsTo(models.devices, { foreignKey: 'device_id', targetKey: 'id' });
    occupantGroupDevices.hasOne(models.occupants_dashboard_attributes, { as: 'dashboard_attributes', foreignKey: 'item_id' });
  };
  return occupantGroupDevices;
};
