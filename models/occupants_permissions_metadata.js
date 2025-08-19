module.exports = (sequelize, DataTypes) => {
  const occupantPermissionMetadata = sequelize.define('occupants_permissions_metadata', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    occupant_permission_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    key: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    value: {
      type: DataTypes.TEXT,
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
    tableName: 'occupants_permissions_metadata',
  });
  occupantPermissionMetadata.associate = (models) => {
    occupantPermissionMetadata.belongsTo(models.occupants_permissions, { foreignKey: 'occupant_permission_id', targetKey: 'id' });
  };
  return occupantPermissionMetadata;
};
