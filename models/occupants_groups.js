module.exports = (sequelize, DataTypes) => {
  const OccupantGroups = sequelize.define('occupants_groups', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      allowNull: false,
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
  },
    {
      freezeTableName: true,
      tableName: 'occupants_groups',
    });
  OccupantGroups.associate = (models) => {
    OccupantGroups.belongsTo(models.occupants_locations, { as: 'occupant_location', foreignKey: 'item_id', targetKey: 'id' });
    OccupantGroups.belongsTo(models.devices, { foreignKey: 'item_id', targetKey: 'id' });
    OccupantGroups.belongsTo(models.occupants, { foreignKey: 'occupant_id', targetKey: 'id' });
    OccupantGroups.belongsTo(models.companies, { foreignKey: 'company_id', targetKey: 'id' });
    OccupantGroups.hasOne(models.occupants_dashboard_attributes, { as: 'dashboard_attributes', foreignKey: 'item_id' });
  };
  return OccupantGroups;
};
