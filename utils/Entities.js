const Entities = Object.freeze({
    deleteDevice: {
        entity_name: 'DeleteDeviceJob',
        event_name: {
            job: 'JobInfo',
            activity_log_delete: 'ActivityLogsDeleted',
            device_delete: 'DeviceDeleted',
            devices_delete: 'DevicesDeleted',
            gateway_delete: 'GatewayDeleted',
            occupant_device_deleted: 'OccupantGatewayDeviceDeleted',
            owner_unregistered_gateway: 'OwnerUnregisteredGateway',
            gateway_unregistered: 'GatewayUnregistered',
        },
    },
    deleteDeviceEvent: {
        entity_name: 'DeleteDeviceEventJob',
        event_name: {
            job: 'JobInfo',
            device_event_delete: 'DeviceEventsDeleted',
        }
    },
    addDevice: {
        entity_name: 'AddDeviceJob',
        event_name: {
            job: 'JobInfo'
        },
    },
    locations: {
        entity_name: 'Locations',
        event_name: {
            created: 'LocationCreated',
            removed: 'LocationRemoved',
            updated: 'LocationUpdated',
            added: 'LocationAdded',
            deleted: 'LocationDeleted',
            unlinked: 'LocationUnlinked',
            linked: 'LocationLinked',
            unassigned: 'LocationUnassigned',
            assigned: 'LocationAssigned',
            occupant_checked_in: 'OccupantCheckedIn',
            occupant_checked_out: 'OccupantCheckedOut',
            occupant_invitation_updated: 'OccupantInvitationUpdated',
            occupant_invitation_deleted: 'OccupantInvitationDeleted',
            gateway_linked: 'GatewayLinked',
            gateway_unlinked: 'GatewayUnlinked',
            device_linked: 'DeviceLinked',
            device_unlinked: 'DeviceUnlinked',
        }
    },
    addresses: {
        entity_name: 'Addresses',
        event_name: {
            updated: 'AddressUpdated',
            added: 'AddressAdded',
            deleted: 'AddressDeleted',
        },
    },
    devices: {
        entity_name: 'Devices',
        event_name: {
            location_updated: 'LocationUpdated',
            device_added: "DeviceAdded",
            gateway_added: "GatewayAdded",
            owner_unregistered_gateway: 'OwnerUnregisteredGateway',
            gateway_unregistered: 'GatewayUnregistered',
            device_event_count_exceeded: 'DeviceEventCountExceeded'
        }
    },
    deleteOccupant: {
        entity_name: 'OccupantDeleteJob',
        event_name: {
            job: 'JobInfo',
            occupant_invite_delete: 'OccupantInviteDeleted',
            occupant_location_delete: 'OccupantsLocationsDeleted',
            occupant_delete: 'OccupantDeleted',
            device_provision_delete: 'DeviceProvisionDeleted',
            occupant_attribute_delete: 'OccupantAtrributeDeleted',
            cognito_occupant_delete: 'OccupantDeletedFromCognito',
            occupant_default_room_delete: 'LocationDeleted',
            alert_communication_config_deleted: 'AlertCommunicationConfigDeleted',
            occupant_notification_token_deleted: 'OccupantNotificationTokenDeleted',
            occupant_metadata_deleted: 'OccupantMetadataDeleted',
            occupant_group_deleted: 'OccupantGroupDeleted',
            occupant_permission_deleted: 'OccupantPermissionDeleted',
            occupant_dashboard_attribute_deleted: 'OccupantDashboardAttributeDeleted',
        },
    },
    locationCheckIn: {
        entity_name: 'LocationCheckInJob',
        event_name: {
            job: 'JobInfo',
            location_checkin: 'LocationCheckedIn',
            added: 'OccupantDashboardAttributeAdded',
            updated: 'OccupantDashboardAttributeUpdated',
            job_error: 'JobError'
        },
    },
    locationCheckOut: {
        entity_name: 'LocationCheckOutJob',
        event_name: {
            job: 'JobInfo',
            location_checkout: 'LocationCheckedOut',
            deleted: 'OccupantDashboardAttributeDeleted',
            group_deleted: 'OccupantGroupDeleted',
        },
    },
    userDelete: {
        entity_name: 'UserDeleteJob',
        event_name: {
            job: 'JobInfo',
            user_delete: 'UserDeleted',
            user_invitation_delete: 'UserInvitationDeleted',
            dynamodb_user_delete: 'UserDeletedFromDynamoDB',
            cognito_user_delete: 'UserDeletedFromCognito',
            activity_logs_delete: 'ActivityLogsDeleted',
            access_permission_delete: 'AccessPermissionsDeleted',
            location_permission_delete: 'LocationPermissionsDeleted',
            core_permission_delete: 'CorePermissionsDeleted',
            occupant_invitation_update: 'OccupantsInvitationsUpdated',
        },
    },
    deleteLocation: {
        entity_name: 'LocationDeleteJob',
        event_name: {
            job: 'JobInfo',
            deleted: 'LocationDeleted',
            location_unlinked: 'LocationUnlinked',
            removed: 'ChildLocationRemoved',
            ShareDeviceToLocationManagersJob: 'ShareDeviceToLocationManagersJob'

        },
    },
    shareDeviceToLocationManagers: {
        entity_name: 'ShareDeviceToLocationManagersJob',
        event_name: {
            job: 'JobInfo',
            shareDevice: 'ShareDevice',
            lockDevice: 'LockDevice',
            unShareDevice: 'UnShareDevice',
            unLockDevice: 'UnLockDevice',
        },
    },
    shareDeviceExistingLocationManagers: {
        entity_name: 'ShareDeviceExistingLocationManagersJob',
        event_name: {
            job: 'JobInfo',
            shareDevice: 'ShareDevice',
            lockDevice: 'LockDevice',
            unShareDevice: 'UnShareDevice',
            unLockDevice: 'UnLockDevice',
            removeAdmin: 'RemoveAdmin',
            locationDevices: 'FetchLocationDevices',
        },
    },
    notes: {
        entity_name: 'notes',
        event_name: {
            added: 'New Record Added',
            updated: 'Existing Record Updated',
            deleted: 'Record Deleted',
        },
    },
    importLocations: {
        entity_name: 'ImportLocationsJob',
        event_name: {
            job: 'JobInfo',
        },
    },
    importGatewayLocations: {
        entity_name: 'ImportGatewayLocationsJob',
        event_name: {
            job: 'JobInfo',
        },
    },
    occupants_gateway_devices: {
        entity_name: 'OccupantGatewayDevices',
        event_name: {
            updated: 'OccupantGatewayDeviceUpdated',
            added: 'OccupantGatewayDeviceAdded',
            deleted: 'OccupantGatewayDeviceDeleted',
        },
    },
    occupants_dashboard_attributes: {
        entity_name: 'OccupantsDashboardAttributes',
        event_name: {
            added: 'OccupantDashboardAttributeAdded',
            updated: 'OccupantDashboardAttributeUpdated',
        },
    },
    occupantsGatewayDashboardAttributesJob: {
        entity_name: 'occupantsGatewayDashboardAttributesJob',
        event_name: {
            job: 'JobInfo',
        },
    },
    DeleteRecordFromDynamoDBJob: {
        entity_name: 'DeleteRecordFromDynamoDBJob',
        event_name: {
            job: 'JobInfo',
        },
    },
    shareDeviceToOccupants: {
        entity_name: 'shareDeviceToOccupants',
        event_name: {
            job: 'JobInfo',
        },
    },
    camera_occupants_permissions: {
        entity_name: 'OccupantsPermissions',
        event_name: {
            added: 'OccupantCameraPermissionAdded',
            updated: 'OccupantCameraPermissionUpdated',
            deleted: 'OccupantCameraPermissionDeleted',
            resend: 'OccupantCameraPermissionResent',
        },
    },
    occupant_gateway_delete: {
        entity_name: 'OccupantGatewayDeleteJob',
        event_name: {
            job: 'JobInfo',
        },
    },
    default_language: {
        event_name: {
            default: 'en',
        }
    },
    email: {
        entity_name: 'Email',
        event_name: {
            sent: 'EmailSent',
            error: 'EmailError'
        }
    },
    SMS: {
        entity_name: 'SMS',
        event_name: {
            sent: 'SMSSent',
            error: 'SMSError',
            exceeded: 'SMSExceeded'
        }
    },
    notification: {
        entity_name: 'Notification',
        event_name: {
            sent: 'NotificationSent',
            error: 'NotificationError'
        }
    },
    camera: {
        entity_name: 'Camera',
        event_name: {
            added: 'CameraAdded',
            deleted: 'CameraDeleted',
            updated: 'CameraUpdated',
        },
    },
    installer: {
        entity_name: 'Installer',
        event_name: {
            added: 'InstallerAdded',
            deleted: 'InstallerDeleted',
            updated: 'InstallerUpdated',
            not_registered:'InstallerNotRegistered'
        },
    },

    occupants_notification_tokens: {
        entity_name: 'OccupantsNotificationTokens',
        event_name: {
            added: 'OccupantNotificationTokenAdded',
            updated: 'OccupantNotificationTokenUpdated',
            deleted: 'OccupantNotificationTokenDeleted',
        },
    },

});

module.exports = { Entities };
