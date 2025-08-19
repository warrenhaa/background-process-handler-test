module.exports = (sequelize, DataTypes) => {
  const corePermissionsMappings = sequelize.define('core_permissions_mappings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
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
    created_by: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    updated_by: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    access_levels: {
      allowNull: true,
      type: DataTypes.ARRAY(DataTypes.TEXT),
    },
  }, {});
  corePermissionsMappings.associate = function (models) {
    corePermissionsMappings.hasMany(models.core_permissions, { foreignKey: 'core_permission_mapping_id', onDelete: 'CASCADE' });
  };
  return corePermissionsMappings;
};
