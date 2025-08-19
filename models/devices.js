module.exports = (sequelize, DataTypes) => {
  const devices = sequelize.define('devices', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
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
    location_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'locations',
        key: 'id',
      },
    },
    type: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    name: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    model: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    status: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    serial_number: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    mac_address: {
      allowNull: true,
      type: DataTypes.STRING,
      set(v) {
        try {
          if (v) {
            if (!v.includes(':')) {
              const formatted = v.match(/.{1,2}/g);
              for (let i = formatted.length; i < 6; i += 1) {
                formatted.unshift('00');
              }
              const mc = formatted.join(':').toUpperCase();
              this.setDataValue('mac_address', mc);
            } else {
              this.setDataValue('mac_address', v);
            }
          } else {
            this.setDataValue('mac_address', null);
          }
        } catch (error) {
          this.setDataValue('mac_address', null);
        }
      },
    },
    firmware_verison: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    gateway_id: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    device_code: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING,
    },
    short_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    datapoints: {
      allowNull: true,
      type: DataTypes.JSONB,
    },
    plan_code: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    rule_group_id: {
      allowNull: true,
      type: DataTypes.UUID,
      references: {
        model: 'rule_groups',
        key: 'id',
      },
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
    timezone: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    latlong: {
      allowNull: true,
      type: DataTypes.JSONB,
    },
  }, {});
  devices.associate = function (models) {
    devices.belongsTo(models.companies, { foreignKey: 'company_id' });
    devices.belongsTo(models.locations, { as: 'locations', foreignKey: 'location_id' });
    devices.belongsTo(models.devices, { as: 'gateway', foreignKey: 'gateway_id' });
    devices.belongsTo(models.rule_groups, { as: 'rule_group', foreignKey: 'rule_group_id', targetKey: 'id' });
  };
  return devices;
};
