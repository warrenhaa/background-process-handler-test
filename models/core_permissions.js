module.exports = (sequelize, DataTypes) => {
  const corePermissions = sequelize.define(
    'core_permissions',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id',
        },
      },
      core_permission_mapping_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'core_permissions_mappings',
          key: 'id',
        },
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      access_level: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      updated_at: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      created_at: {
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
    },
    {},
  );
  corePermissions.associate = function (models) {
    corePermissions.belongsTo(models.core_permissions_mappings, { foreignKey: 'core_permission_mapping_id', onDelete: 'CASCADE' });
  };
  return corePermissions;
};
