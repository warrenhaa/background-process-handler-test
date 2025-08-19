module.exports = (sequelize, DataTypes) => {
  const occupantLocation = sequelize.define('occupants_locations', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    location_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'locations',
        key: 'id',
      },
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants',
        key: 'id',
      },
    },
    check_in_at: {
      allowNull: true,
      type: DataTypes.DATE,
    },
    check_in_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    check_out_at: {
      allowNull: true,
      type: DataTypes.DATE,
    },
    check_out_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
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
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    occupant_invite_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants_locations',
        key: 'id',
      },
    },
  },
  {
    freezeTableName: true,
    tableName: 'occupants_locations',
  });
  occupantLocation.associate = (models) => {
    occupantLocation.belongsTo(models.locations, { as: 'locations', foreignKey: 'location_id' });
    occupantLocation.belongsTo(models.occupants_invitations, { foreignKey: 'occupant_invite_id' });
    occupantLocation.belongsTo(models.occupants, { foreignKey: 'occupant_id' });
  };
  return occupantLocation;
};
