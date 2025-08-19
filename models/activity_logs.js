module.exports = (sequelize, DataTypes) => {
  const activityLogs = sequelize.define('activity_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    event_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
    },
    notes: {
      type: DataTypes.STRING,
    },
    event_time: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUIDV4,
      allowNull: true,
    },
    client_id: {
      type: DataTypes.UUIDV4,
    },
    request_id: {
      type: DataTypes.UUIDV4,
    },
    source_ip: {
      type: DataTypes.STRING,
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
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants',
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
    placeholders_data: {
      allowNull: true,
      type: DataTypes.JSONB
    }
  },
    {
      indexes: [
        {
          unique: false,
          fields: ['entity', 'event_name', 'user_id', 'entity_id', 'occupant_id'],
        },
      ],
    }, {});

  activityLogs.associate = (models) => {
    activityLogs.belongsTo(models.companies, { foreignKey: 'company_id' });
    activityLogs.belongsTo(models.occupants, { foreignKey: 'occupant_id' });
  };

  return activityLogs;
};
