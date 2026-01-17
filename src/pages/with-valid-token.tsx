import type { FC, PropsWithChildren } from "react";
import { Detail } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import isValidToken from "../utils/is-valid-token";
import InvalidTokenView from "./details/invalid-token-view";

const WithValidToken: FC<PropsWithChildren<object>> = ({ children }) => {
  const { isLoading, error } = usePromise(isValidToken, [], {
    failureToastOptions: {
      title: "Invalid API token. Please set one in settings.",
    },
  });

  if (isLoading) return <Detail isLoading />;

  if (error) {
    return <InvalidTokenView />;
  }

  return <>{children}</>;
};

export default WithValidToken;
