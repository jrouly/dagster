import {ApolloClient, gql} from '@apollo/client';
import {Icon, Colors} from '@blueprintjs/core';
import * as React from 'react';
import {useEffect, useState} from 'react';

import {AppContext} from '../app/AppContext';
import {DirectGraphQLSubscription} from '../app/DirectGraphQLSubscription';
import {LocationStateChangeEventType} from '../types/globalTypes';
import {ButtonLink} from '../ui/ButtonLink';
import {Group} from '../ui/Group';
import {Caption} from '../ui/Text';
import {WorkspaceContext} from '../workspace/WorkspaceContext';

import {LocationStateChangeSubscription} from './types/LocationStateChangeSubscription';

const LOCATION_STATE_CHANGE_SUBSCRIPTION = gql`
  subscription LocationStateChangeSubscription {
    locationStateChangeEvents {
      event {
        message
        locationName
        eventType
        serverId
      }
    }
  }
`;

interface StateObserverProps {
  client: ApolloClient<any>;
}

export const RepositoryLocationStateObserver = ({client}: StateObserverProps) => {
  const {locations, refetch} = React.useContext(WorkspaceContext);
  const [updatedLocations, setUpdatedLocations] = useState<string[]>([]);
  const [erroredLocations, setErroredLocations] = useState<string[]>([]);
  const totalMessages = updatedLocations.length + erroredLocations.length;

  const {websocketURI} = React.useContext(AppContext);

  useEffect(() => {
    const onHandleMessages = (
      messages: LocationStateChangeSubscription[], //   isFirstResponse: boolean,
    ) => {
      const {
        locationStateChangeEvents: {event},
      } = messages[0];
      const {locationName, eventType, serverId} = event;

      switch (eventType) {
        case LocationStateChangeEventType.LOCATION_ERROR:
          refetch();
          setUpdatedLocations((s) => s.filter((name) => name !== locationName));
          return;
        case LocationStateChangeEventType.LOCATION_UPDATED:
          const matchingRepositoryLocation = locations.find((n) => n.name === locationName);
          if (
            matchingRepositoryLocation &&
            matchingRepositoryLocation?.__typename === 'RepositoryLocation' &&
            matchingRepositoryLocation.serverId !== serverId
          ) {
            setUpdatedLocations((s) => [...s, locationName]);
          }
          return;
      }
    };

    const subscriptionToken = new DirectGraphQLSubscription<LocationStateChangeSubscription>(
      websocketURI,
      LOCATION_STATE_CHANGE_SUBSCRIPTION,
      {},
      onHandleMessages,
      () => {}, // https://github.com/dagster-io/dagster/issues/2151
    );

    return () => {
      subscriptionToken.close();
    };
  }, [locations, refetch, websocketURI]);

  return totalMessages > 0 ? (
    <Group background={Colors.GRAY5} direction="column" spacing={0}>
      {updatedLocations.length > 0 ? (
        <Group padding={{vertical: 8, horizontal: 12}} direction="row" spacing={8}>
          <Icon icon="warning-sign" color={Colors.DARK_GRAY3} iconSize={14} />
          <Caption color={Colors.DARK_GRAY3}>
            {updatedLocations.length === 1
              ? `Repository location ${updatedLocations[0]} has been updated,` // Be specific when there's only one repository location updated
              : 'One or more repository locations have been updated,'}{' '}
            and new data is available.{' '}
            <ButtonLink
              color={{link: Colors.DARK_GRAY3, hover: Colors.DARK_GRAY1, active: Colors.DARK_GRAY1}}
              underline="always"
              onClick={() => {
                setUpdatedLocations([]);
                setErroredLocations([]);
                refetch();
                client.resetStore();
              }}
            >
              Update data
            </ButtonLink>
          </Caption>
        </Group>
      ) : null}
    </Group>
  ) : null;
};
