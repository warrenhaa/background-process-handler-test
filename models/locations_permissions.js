module.exports = (sequelize, DataTypes) => {
  const locationsPermissions = sequelize.define('locations_permissions', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    location_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'locations',
        key: 'id',
      },
    },
    role: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    created_by: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    updated_by: {
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
  locationsPermissions.associate = function (models) {
    // associations can be defined here
    locationsPermissions.belongsTo(models.locations, { foreignKey: 'location_id', onDelete: 'CASCADE' });
    locationsPermissions.belongsTo(models.users, { foreignKey: 'user_id' });
  };
  return locationsPermissions;
};
