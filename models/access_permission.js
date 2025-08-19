module.exports = (sequelize, DataTypes) => {
  const accessPermissions = sequelize.define('access_permissions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      unique: true,
    },
    company_id: {
      type: DataTypes.UUID,
    },
    permissions: {
      type: DataTypes.JSONB,
    },
    created_by: {
      type: DataTypes.STRING,
    },
    updated_by: {
      type: DataTypes.STRING,
    },
  }, {});
  accessPermissions.associate = (models) => {
    accessPermissions.belongsTo(models.users, { foreignKey: 'id' });
  };
  return accessPermissions;
};
